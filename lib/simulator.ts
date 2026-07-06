import { fetchDividends, fetchPrices } from './statusInvest';
import type { DividendMode, DividendPoint, HoldingResult, PortfolioItem, PricePoint, SimulationInput, SimulationResult, Transaction } from './types';
type Data = Record<string, { prices: PricePoint[]; dividends: DividendPoint[] }>;
const monthsBetween = (a:string,b:string) => { const s=new Date(a), e=new Date(b), out:string[]=[]; for(let d=new Date(s.getFullYear(),s.getMonth()+1,1); d<=e; d.setMonth(d.getMonth()+1)) out.push(d.toISOString().slice(0,10)); return out; };
const priceOnOrAfter = (prices: PricePoint[], date: string) => prices.find(p => p.date >= date)?.price ?? prices.at(-1)?.price ?? 0;
const priceOnOrBefore = (prices: PricePoint[], date: string) => [...prices].reverse().find(p => p.date <= date)?.price ?? prices[0]?.price ?? 0;
const normalizeAlloc = (hs: PortfolioItem[]) => {
  const sum = hs.reduce((a,h)=>a+h.allocation,0);
  if (sum <= 0) return hs.map(h => ({ ...h, allocation: 1 / hs.length }));
  return hs.map(h => ({...h, allocation: h.allocation / sum}));
};
const yearsBetween = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 31557600000;
const moneyWeightedAnnualReturn = (flows: { date: string; amount: number }[]) => {
  const hasPositive = flows.some(f => f.amount > 0), hasNegative = flows.some(f => f.amount < 0);
  if (!hasPositive || !hasNegative) return 0;
  const start = flows[0].date;
  const npv = (rate: number) => flows.reduce((sum, flow) => sum + flow.amount / ((1 + rate) ** yearsBetween(start, flow.date)), 0);
  let low = -0.9999, high = 1;
  while (npv(high) > 0 && high < 1000) high *= 2;
  for (let i = 0; i < 80; i++) {
    const mid = (low + high) / 2;
    if (npv(mid) > 0) low = mid; else high = mid;
  }
  return ((low + high) / 2) * 100;
};
const timeWeightedAnnualReturn = (series: SimulationResult['series'], startDate: string, endDate: string) => {
  if (series.length < 2) return 0;
  let compounded = 1;
  for (let i = 1; i < series.length; i++) {
    const previous = series[i - 1];
    const current = series[i];
    const externalFlow = current.contributions - previous.contributions;
    if (previous.value > 0) compounded *= (current.value - externalFlow) / previous.value;
  }
  const years = Math.max(1 / 365, yearsBetween(startDate, endDate));
  return (compounded ** (1 / years) - 1) * 100;
};

export async function loadSimulationData(input: SimulationInput): Promise<Data> {
  const tickers = [...new Set(input.holdings.map(h => h.ticker.toUpperCase()))];
  const entries = await Promise.all(tickers.map(async t => [t, { prices: await fetchPrices(t, input.startDate, input.endDate), dividends: await fetchDividends(t) }] as const));
  return Object.fromEntries(entries);
}

export function simulatePortfolioTimeline(input: SimulationInput, data: Data): SimulationResult {
  const holdings = normalizeAlloc(input.holdings).map(h => ({ ...h, shares: 0, cost: 0, dividends: 0, reinvestedDividends: 0 }));
  let cash = 0, contributions = input.initialInvestment, totalDividends = 0, totalReinvested = 0;
  const tx: Transaction[] = [];
  const externalFlows = [{ date: input.startDate, amount: -input.initialInvestment }];
  const buy = (date: string, amount: number) => holdings.forEach(h => { const p = priceOnOrAfter(data[h.ticker]?.prices ?? [], date); if (p > 0) { const a = amount*h.allocation; const sh = a/p; h.shares += sh; h.cost += a; tx.push({ date, ticker: h.ticker, type: 'BUY', shares: sh, price: p, amount: a }); }});
  buy(input.startDate, input.initialInvestment);
  const divs = Object.values(data).flatMap(x => x.dividends).filter(d => d.date>=input.startDate && d.date<=input.endDate).sort((a,b)=>a.date.localeCompare(b.date));
  const events = [input.startDate, input.endDate, ...monthsBetween(input.startDate,input.endDate), ...Object.values(data).flatMap(x => x.prices.map(p=>p.date)), ...divs.flatMap(d => [d.date, d.paymentDate])].filter(d => d>=input.startDate && d<=input.endDate).sort();
  const uniqueEvents = [...new Set(events)];
  let divIdx = 0;
  const pendingDividends: { dividend: DividendPoint; amount: number }[] = [];
  const series = [] as SimulationResult['series'];
  for (const date of uniqueEvents) {
    if (date.endsWith('-01') && date !== input.startDate && input.monthlyContribution > 0) { contributions += input.monthlyContribution; externalFlows.push({ date, amount: -input.monthlyContribution }); tx.push({ date, ticker: 'CASH', type: 'CONTRIBUTION', amount: input.monthlyContribution }); buy(date, input.monthlyContribution); }
    while (divIdx < divs.length && divs[divIdx].date <= date) {
      const d = divs[divIdx++];
      const h = holdings.find(x => x.ticker === d.ticker);
      if (h && input.dividendMode !== 'ignore') {
        const amount = h.shares * d.value;
        if (amount > 0) pendingDividends.push({ dividend: d, amount });
      }
    }
    for (let i = 0; i < pendingDividends.length;) {
      const { dividend: d, amount } = pendingDividends[i];
      if (d.paymentDate > date) { i++; continue; }
      pendingDividends.splice(i, 1);
      const h = holdings.find(x => x.ticker === d.ticker);
      if (!h) continue;
      h.dividends += amount; totalDividends += amount; tx.push({ date: d.paymentDate, ticker: d.ticker, type: 'DIVIDEND', amount });
      cash += amount;
    }
    const value = holdings.reduce((a,h)=>a+h.shares*priceOnOrBefore(data[h.ticker]?.prices ?? [], date),0) + cash;
    if (series.at(-1)?.date !== date) series.push({ date, value, contributions, cash });
  }
  const holdingResults: HoldingResult[] = holdings.map(h => { const value = h.shares * priceOnOrBefore(data[h.ticker]?.prices ?? [], input.endDate); return { ticker: h.ticker, shares: h.shares, value, cost: h.cost, returnPct: h.cost ? ((value + h.dividends - h.reinvestedDividends - h.cost)/h.cost)*100 : 0, dividends: h.dividends }; });
  const finalValue = holdingResults.reduce((a,h)=>a+h.value,0)+cash;
  const dividendTx = tx.filter(t => t.type === 'DIVIDEND');
  const dividendsByYear = Object.entries(dividendTx.reduce<Record<string,number>>((acc,t)=>{ const y=t.date.slice(0,4); acc[y]=(acc[y]||0)+t.amount; return acc; },{})).map(([year,amount])=>({year, amount}));
  const totalReturn = ((finalValue-contributions)/contributions)*100;
  const moneyWeightedAnnualizedReturn = moneyWeightedAnnualReturn([...externalFlows, { date: input.endDate, amount: finalValue }]);
  const timeWeightedAnnualizedReturn = timeWeightedAnnualReturn(series, input.startDate, input.endDate);
  return { finalValue, totalReturn, cagr: moneyWeightedAnnualizedReturn, moneyWeightedAnnualizedReturn, timeWeightedAnnualizedReturn, totalDividends, totalDividendsReinvested: totalReinvested, annualDividendIncome: dividendTx.filter(t=>t.date.slice(0,4)===input.endDate.slice(0,4)).reduce((a,t)=>a+t.amount,0), cashBalance: cash, holdings: holdingResults, transactions: tx, dividends: divs, series, allocation: holdingResults.map(h=>({ ticker: h.ticker, value: h.value })), dividendsByYear, best: [...holdingResults].sort((a,b)=>b.returnPct-a.returnPct)[0], worst: [...holdingResults].sort((a,b)=>a.returnPct-b.returnPct)[0] };
}

export function runSimulation(input: SimulationInput, data: Data): SimulationResult { return simulatePortfolioTimeline(input, data); }
export async function simulate(input: SimulationInput) { return simulatePortfolioTimeline(input, await loadSimulationData(input)); }
