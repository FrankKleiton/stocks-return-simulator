import { fetchDividends, fetchPrices } from './statusInvest';
import type { DividendMode, DividendPoint, HoldingResult, PortfolioItem, PricePoint, SimulationInput, SimulationResult, Transaction } from './types';
import { cagr } from './metrics';

type Data = Record<string, { prices: PricePoint[]; dividends: DividendPoint[] }>;
const monthsBetween = (a:string,b:string) => { const s=new Date(a), e=new Date(b), out:string[]=[]; for(let d=new Date(s.getFullYear(),s.getMonth()+1,1); d<=e; d.setMonth(d.getMonth()+1)) out.push(d.toISOString().slice(0,10)); return out; };
const priceOnOrAfter = (prices: PricePoint[], date: string) => prices.find(p => p.date >= date)?.price ?? prices.at(-1)?.price ?? 0;
const priceOnOrBefore = (prices: PricePoint[], date: string) => [...prices].reverse().find(p => p.date <= date)?.price ?? prices[0]?.price ?? 0;
const normalizeAlloc = (hs: PortfolioItem[]) => {
  const sum = hs.reduce((a,h)=>a+h.allocation,0);
  if (sum <= 0) return hs.map(h => ({ ...h, allocation: 1 / hs.length }));
  return hs.map(h => ({...h, allocation: h.allocation / sum}));
};

export async function loadSimulationData(input: SimulationInput): Promise<Data> {
  const tickers = [...new Set(input.holdings.map(h => h.ticker.toUpperCase()))];
  const entries = await Promise.all(tickers.map(async t => [t, { prices: await fetchPrices(t, input.startDate, input.endDate), dividends: await fetchDividends(t) }] as const));
  return Object.fromEntries(entries);
}

export function runSimulation(input: SimulationInput, data: Data): SimulationResult {
  const holdings = normalizeAlloc(input.holdings).map(h => ({ ...h, shares: 0, cost: 0, dividends: 0 }));
  let cash = 0, contributions = input.initialInvestment, totalDividends = 0, totalReinvested = 0;
  const tx: Transaction[] = [];
  const buy = (date: string, amount: number) => holdings.forEach(h => { const p = priceOnOrAfter(data[h.ticker]?.prices ?? [], date); if (p > 0) { const a = amount*h.allocation; const sh = a/p; h.shares += sh; h.cost += a; tx.push({ date, ticker: h.ticker, type: 'BUY', shares: sh, price: p, amount: a }); }});
  buy(input.startDate, input.initialInvestment);
  const divs = Object.values(data).flatMap(x => x.dividends).filter(d => d.date>=input.startDate && d.date<=input.endDate).sort((a,b)=>a.date.localeCompare(b.date));
  const events = [input.startDate, input.endDate, ...monthsBetween(input.startDate,input.endDate), ...Object.values(data).flatMap(x => x.prices.map(p=>p.date)), ...divs.flatMap(d => [d.date, d.paymentDate])].filter(d => d>=input.startDate && d<=input.endDate).sort();
  const uniqueEvents = [...new Set(events)];
  let divIdx = 0;
  const pendingDividends: { dividend: DividendPoint; amount: number }[] = [];
  const series = [] as SimulationResult['series'];
  for (const date of uniqueEvents) {
    if (date.endsWith('-01') && date !== input.startDate && input.monthlyContribution > 0) { contributions += input.monthlyContribution; tx.push({ date, ticker: 'CASH', type: 'CONTRIBUTION', amount: input.monthlyContribution }); buy(date, input.monthlyContribution); }
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
      if (input.dividendMode === 'reinvest') { const p = priceOnOrAfter(data[d.ticker].prices, d.paymentDate); if (p > 0) { const sh = amount/p; h.shares += sh; h.cost += amount; totalReinvested += amount; tx.push({ date: d.paymentDate, ticker: d.ticker, type: 'REINVEST', shares: sh, price: p, amount }); } else cash += amount; } else cash += amount;
    }
    const value = holdings.reduce((a,h)=>a+h.shares*priceOnOrBefore(data[h.ticker]?.prices ?? [], date),0) + cash;
    if (series.at(-1)?.date !== date) series.push({ date, value, contributions, cash });
  }
  const holdingResults: HoldingResult[] = holdings.map(h => { const value = h.shares * priceOnOrBefore(data[h.ticker]?.prices ?? [], input.endDate); return { ticker: h.ticker, shares: h.shares, value, cost: h.cost, returnPct: h.cost ? ((value + h.dividends - h.cost)/h.cost)*100 : 0, dividends: h.dividends }; });
  const finalValue = holdingResults.reduce((a,h)=>a+h.value,0)+cash;
  const years = Math.max(1/365, (new Date(input.endDate).getTime()-new Date(input.startDate).getTime())/31557600000);
  const dividendTx = tx.filter(t => t.type === 'DIVIDEND');
  const dividendsByYear = Object.entries(dividendTx.reduce<Record<string,number>>((acc,t)=>{ const y=t.date.slice(0,4); acc[y]=(acc[y]||0)+t.amount; return acc; },{})).map(([year,amount])=>({year, amount}));
  return { finalValue, totalReturn: ((finalValue-contributions)/contributions)*100, cagr: cagr(contributions, finalValue, years), totalDividends, totalDividendsReinvested: totalReinvested, annualDividendIncome: dividendTx.filter(t=>t.date.slice(0,4)===input.endDate.slice(0,4)).reduce((a,t)=>a+t.amount,0), cashBalance: cash, holdings: holdingResults, transactions: tx, dividends: divs, series, allocation: holdingResults.map(h=>({ ticker: h.ticker, value: h.value })), dividendsByYear, best: [...holdingResults].sort((a,b)=>b.returnPct-a.returnPct)[0], worst: [...holdingResults].sort((a,b)=>a.returnPct-b.returnPct)[0] };
}

export async function simulate(input: SimulationInput) { return runSimulation(input, await loadSimulationData(input)); }
