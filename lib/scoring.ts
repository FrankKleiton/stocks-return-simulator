import { avg, cagr, clamp, stdev } from './metrics';
import { fetchDividends, fetchIndicators, fetchStockList } from './statusInvest';
import type { Recommendation } from './types';

type ScoredRecommendation = Recommendation & {
  _profitabilityScore: number;
  _stabilityScore: number;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export async function scoreTicker(base: Awaited<ReturnType<typeof fetchStockList>>[number]): Promise<ScoredRecommendation> {
  const [indicators, dividends] = await Promise.allSettled([fetchIndicators(base.ticker), fetchDividends(base.ticker)]).then(r => [r[0].status==='fulfilled'?r[0].value:[], r[1].status==='fulfilled'?r[1].value:[]] as const);
  const roes = indicators.map(i => i.roe || 0).filter(Boolean);
  const roics = indicators.map(i => i.roic || 0).filter(Boolean);
  const earnings = indicators.map(i => i.earnings || 0).filter(Boolean);
  const revenues = indicators.map(i => i.revenue || 0).filter(Boolean);
  const debts = indicators.map(i => i.debtEquity || 0).filter(x => Number.isFinite(x));
  const pvps = indicators.map(i => i.pVp || 0).filter(x => x > 0 && Number.isFinite(x));

  const averageRoe = avg(roes.length ? roes : [base.roe]);
  const averageRoic = avg(roics.length ? roics : [base.roic]);
  const avgPVp = avg(pvps.length ? pvps : [base.pVp]) || 0;
  const avgDebt = avg(debts.length ? debts : [base.debtEquity]);
  const earningsYield = base.evEbit > 0 ? 100 / base.evEbit : base.pL > 0 ? 100 / base.pL : 0;

  // Greenblatt-inspired valuation leg: cheaper earnings yield is better.
  // P/VP is a secondary Brazilian-market value check: lower current P/VP is better.
  // DY, ROE and ROIC are directional: higher is better. Debt is penalized.
  const earningsYieldScore = clamp(earningsYield * 2.2, 0, 22);
  const pvpValuation = base.pVp > 0 ? clamp(12 - base.pVp * 2.4, 0, 12) : 0;
  const peValuation = base.pL > 0 ? clamp(12 - base.pL * 0.6, 0, 12) : 0;
  const dyValuation = base.dy > 0 ? clamp(base.dy * 1.1, 0, 10) : 0;
  const profitabilitySupport = clamp(base.roe / 4, 0, 8) + clamp(base.roic / 5, 0, 8);
  const leveragePenalty = clamp(Math.max(0, avgDebt) * 1.5, 0, 10);
  const valuationScore = clamp(earningsYieldScore + pvpValuation + peValuation + dyValuation + profitabilitySupport - leveragePenalty, 0, 50) * 2;

  const years = new Set(dividends.map(d => d.paymentDate.slice(0,4))).size;
  const earningsCagr = earnings.length > 1 ? cagr(earnings[0], earnings[earnings.length-1], earnings.length-1) : base.earningsCagr5;
  const revenueCagr = revenues.length > 1 ? cagr(revenues[0], revenues[revenues.length-1], revenues.length-1) : base.revenueCagr5;
  const positiveYears = indicators.filter(i => (i.earnings ?? 0) > 0).length;

  const profitabilityScore =
    clamp(base.roic * 1.4, 0, 35) +
    clamp(base.roe * 0.9, 0, 25) +
    clamp(20 - stdev(roics), 0, 10);

  const stabilityScore =
    clamp(18 - stdev(roes), 0, 12) +
    clamp(revenueCagr, 0, 8) +
    clamp(positiveYears * 1.1, 0, 8) +
    clamp(8 - Math.max(0, avgDebt), 0, 6);

  return {
    ...base,
    qualityScore: 0,
    valuationScore: round1(valuationScore),
    magicFormulaScore: 0,
    earningsYield: round1(earningsYield),
    averageRoe,
    averageRoic,
    averagePVp: avgPVp,
    averageDividendYield: base.dy,
    yearsPayingDividends: years,
    earningsCagr,
    _profitabilityScore: profitabilityScore,
    _stabilityScore: stabilityScore
  };
}

function rankDescending<T>(items: T[], value: (item: T) => number): Map<T, number> {
  return new Map([...items].sort((a,b) => value(b) - value(a)).map((item, index) => [item, index + 1]));
}

export async function getRecommendations(limit = 80): Promise<Recommendation[]> {
  const stocks = await fetchStockList();
  const liquid = stocks
    .filter(s => s.price > 0 && s.dy >= 6)
    .sort((a,b)=>b.liquidity-a.liquidity)
    .slice(0, limit);
  const chunks: ScoredRecommendation[] = [];
  for (let i=0; i<liquid.length; i+=8) chunks.push(...await Promise.all(liquid.slice(i,i+8).map(scoreTicker)));
  const eligible = chunks.filter(s => s.averageRoe >= 12);

  const roicRank = rankDescending(eligible, s => s.roic);
  const earningsYieldRank = rankDescending(chunks, s => s.earningsYield);
  const maxCombinedRank = Math.max(1, eligible.length * 2 - 2);

  return eligible.map((scored) => {
    const combinedRank = (roicRank.get(scored) ?? eligible.length) + (earningsYieldRank.get(scored) ?? eligible.length);
    const magicFormulaScore = clamp(100 - ((combinedRank - 2) / maxCombinedRank) * 100, 0, 100);

    // Variant of Joel Greenblatt's Magic Formula for Brazilian stocks:
    // 55% combined rank of ROIC + earnings yield, 25% long-term profitability,
    // 20% financial/revenue stability. Dividend years are informational only.
    const qualityScore = clamp(magicFormulaScore * 0.55 + scored._profitabilityScore * 0.25 + scored._stabilityScore * 0.20, 0, 100);
    const { _profitabilityScore, _stabilityScore, ...stock } = scored;
    return { ...stock, magicFormulaScore: round1(magicFormulaScore), qualityScore: round1(qualityScore) };
  }).sort((a,b)=>b.qualityScore-a.qualityScore);
}
