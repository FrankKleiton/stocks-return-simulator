import { avg, cagr, clamp, stdev } from './metrics';
import { fetchDividendsMany, fetchIndicatorsMany, fetchStockList } from './investidor10';
import type { DividendPoint, IndicatorPoint, Recommendation, StockSummary } from './types';

type ScoredRecommendation = Recommendation & {
  _profitabilityScore: number;
  _stabilityScore: number;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function scoreTicker(base: StockSummary, indicators: IndicatorPoint[] = [], dividends: DividendPoint[] = []): ScoredRecommendation {
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
  const earningsYield = base.pL > 0 ? (1 / base.pL) * 100 : 0;

  // Valuation sorting is intentionally simple: cheaper P/E and higher ROE score better.
  const peValuation = base.pL > 0 ? clamp(20 - base.pL, 0, 20) * 2.5 : 0;
  const roeValuation = clamp(base.roe, 0, 25) * 2;
  const valuationScore = clamp(peValuation + roeValuation, 0, 100);

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
    .filter(s => s.price > 0 && s.roic > 0 && (s.evEbit > 0 || s.pL > 0))
    .sort((a,b)=>b.liquidity-a.liquidity)
    .slice(0, limit);
  const tickers = liquid.map(s => s.ticker);
  // Each ticker costs one page fetch on Investidor10, so history is loaded with bounded concurrency.
  // Missing history degrades a ticker's score instead of failing the whole ranking.
  const [indicators, dividends] = await Promise.all([
    fetchIndicatorsMany(tickers).catch(() => new Map<string, IndicatorPoint[]>()),
    fetchDividendsMany(tickers).catch(() => new Map<string, DividendPoint[]>())
  ]);
  const eligible = liquid.map(s => scoreTicker(s, indicators.get(s.ticker) ?? [], dividends.get(s.ticker) ?? []));

  const roeRank = rankDescending(eligible, s => s.roe);
  const earningsYieldRank = rankDescending(eligible, s => s.earningsYield);
  const maxCombinedRank = Math.max(1, eligible.length * 2 - 2);

  return eligible.map((scored) => {
    const combinedRank = (roeRank.get(scored) ?? eligible.length) + (earningsYieldRank.get(scored) ?? eligible.length);
    const magicFormulaScore = clamp(100 - ((combinedRank - 2) / maxCombinedRank) * 100, 0, 100);

    // Variant of Joel Greenblatt's Magic Formula for Brazilian stocks:
    // 55% combined rank of ROE + earnings yield (cheapest P/E), 25% long-term profitability,
    // 20% financial/revenue stability. Dividend years are informational only.
    const qualityScore = clamp(magicFormulaScore * 0.55 + scored._profitabilityScore * 0.25 + scored._stabilityScore * 0.20, 0, 100);
    const { _profitabilityScore, _stabilityScore, ...stock } = scored;
    return { ...stock, magicFormulaScore: round1(magicFormulaScore), qualityScore: round1(qualityScore) };
  }).sort((a,b)=>b.qualityScore-a.qualityScore);
}
