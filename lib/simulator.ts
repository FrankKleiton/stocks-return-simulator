import { fetchDividends, fetchPrices } from './statusInvest';
import type { DividendPoint, HoldingResult, PortfolioItem, PricePoint, SimulationInput, SimulationResult, TimePoint, Transaction } from './types';

type MarketData = Record<string, { prices: PricePoint[]; dividends: DividendPoint[] }>;
type SimHolding = PortfolioItem & { shares: number; cost: number; dividends: number; reinvestedDividends: number };
type CashFlow = { date: string; amount: number };
type PendingDividend = { dividend: DividendPoint; amount: number };

const MS_PER_YEAR = 31_557_600_000;
const MAX_IRR_SEARCH_RATE = 1000;
const IRR_ITERATIONS = 80;

const byDate = (a: string, b: string) => a.localeCompare(b);
const within = (date: string, start: string, end: string) => date >= start && date <= end;

const yearsBetween = (start: string, end: string) => (new Date(end).getTime() - new Date(start).getTime()) / MS_PER_YEAR;

const monthsBetween = (startDate: string, endDate: string) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const months: string[] = [];

  for (const date = new Date(start.getFullYear(), start.getMonth() + 1, 1); date <= end; date.setMonth(date.getMonth() + 1)) {
    months.push(date.toISOString().slice(0, 10));
  }

  return months;
};

const priceOnOrAfter = (prices: PricePoint[], date: string) => prices.find(p => p.date >= date)?.price ?? prices.at(-1)?.price ?? 0;
const priceOnOrBefore = (prices: PricePoint[], date: string) => [...prices].reverse().find(p => p.date <= date)?.price ?? prices[0]?.price ?? 0;

function normalizeAllocations(holdings: PortfolioItem[]) {
  const totalAllocation = holdings.reduce((sum, holding) => sum + holding.allocation, 0);
  if (totalAllocation <= 0) return holdings.map(holding => ({ ...holding, allocation: 1 / holdings.length }));
  return holdings.map(holding => ({ ...holding, allocation: holding.allocation / totalAllocation }));
}

function moneyWeightedAnnualReturn(flows: CashFlow[]) {
  const hasPositive = flows.some(flow => flow.amount > 0);
  const hasNegative = flows.some(flow => flow.amount < 0);
  if (!hasPositive || !hasNegative) return 0;

  const start = flows[0].date;
  const npv = (rate: number) => flows.reduce((sum, flow) => sum + flow.amount / ((1 + rate) ** yearsBetween(start, flow.date)), 0);

  let low = -0.9999;
  let high = 1;
  while (npv(high) > 0 && high < MAX_IRR_SEARCH_RATE) high *= 2;

  for (let i = 0; i < IRR_ITERATIONS; i++) {
    const mid = (low + high) / 2;
    if (npv(mid) > 0) low = mid;
    else high = mid;
  }

  return ((low + high) / 2) * 100;
}

function timeWeightedAnnualReturn(series: TimePoint[], startDate: string, endDate: string) {
  if (series.length < 2) return 0;

  let compoundedReturn = 1;
  for (let i = 1; i < series.length; i++) {
    const previous = series[i - 1];
    const current = series[i];
    const externalFlow = current.contributions - previous.contributions;
    if (previous.value > 0) compoundedReturn *= (current.value - externalFlow) / previous.value;
  }

  const years = Math.max(1 / 365, yearsBetween(startDate, endDate));
  return (compoundedReturn ** (1 / years) - 1) * 100;
}

function createHoldings(holdings: PortfolioItem[]): SimHolding[] {
  return normalizeAllocations(holdings).map(holding => ({ ...holding, shares: 0, cost: 0, dividends: 0, reinvestedDividends: 0 }));
}

function buyHoldings(holdings: SimHolding[], data: MarketData, date: string, amount: number, transactions: Transaction[]) {
  for (const holding of holdings) {
    const price = priceOnOrAfter(data[holding.ticker]?.prices ?? [], date);
    if (price <= 0) continue;

    const allocatedAmount = amount * holding.allocation;
    const shares = allocatedAmount / price;
    holding.shares += shares;
    holding.cost += allocatedAmount;
    transactions.push({ date, ticker: holding.ticker, type: 'BUY', shares, price, amount: allocatedAmount });
  }
}

function collectDividends(input: SimulationInput, data: MarketData) {
  return Object.values(data)
    .flatMap(item => item.dividends)
    .filter(dividend => within(dividend.date, input.startDate, input.endDate))
    .sort((a, b) => byDate(a.date, b.date));
}

function collectEvents(input: SimulationInput, data: MarketData, dividends: DividendPoint[]) {
  return [...new Set([
    input.startDate,
    input.endDate,
    ...monthsBetween(input.startDate, input.endDate),
    ...Object.values(data).flatMap(item => item.prices.map(price => price.date)),
    ...dividends.flatMap(dividend => [dividend.date, dividend.paymentDate])
  ].filter(date => within(date, input.startDate, input.endDate)).sort())];
}

function valueHoldings(holdings: SimHolding[], data: MarketData, date: string) {
  return holdings.reduce((sum, holding) => sum + holding.shares * priceOnOrBefore(data[holding.ticker]?.prices ?? [], date), 0);
}

function toHoldingResults(holdings: SimHolding[], data: MarketData, endDate: string): HoldingResult[] {
  return holdings.map(holding => {
    const value = holding.shares * priceOnOrBefore(data[holding.ticker]?.prices ?? [], endDate);
    const returnPct = holding.cost ? ((value + holding.dividends - holding.reinvestedDividends - holding.cost) / holding.cost) * 100 : 0;
    return { ticker: holding.ticker, shares: holding.shares, value, cost: holding.cost, returnPct, dividends: holding.dividends };
  });
}

function groupDividendsByYear(transactions: Transaction[]) {
  return Object.entries(transactions.reduce<Record<string, number>>((acc, transaction) => {
    const year = transaction.date.slice(0, 4);
    acc[year] = (acc[year] ?? 0) + transaction.amount;
    return acc;
  }, {})).map(([year, amount]) => ({ year, amount }));
}

export async function loadSimulationData(input: SimulationInput): Promise<MarketData> {
  const tickers = [...new Set(input.holdings.map(holding => holding.ticker.toUpperCase()))];
  const entries = await Promise.all(tickers.map(async ticker => [ticker, { prices: await fetchPrices(ticker, input.startDate, input.endDate), dividends: await fetchDividends(ticker) }] as const));
  return Object.fromEntries(entries);
}

export function simulatePortfolioTimeline(input: SimulationInput, data: MarketData): SimulationResult {
  const holdings = createHoldings(input.holdings);
  const transactions: Transaction[] = [];
  const externalFlows: CashFlow[] = [{ date: input.startDate, amount: -input.initialInvestment }];

  let cash = 0;
  let contributions = input.initialInvestment;
  let totalDividends = 0;
  let totalReinvested = 0;
  let dividendIndex = 0;
  const pendingDividends: PendingDividend[] = [];
  const series: TimePoint[] = [];

  buyHoldings(holdings, data, input.startDate, input.initialInvestment, transactions);

  const dividends = collectDividends(input, data);
  const events = collectEvents(input, data, dividends);

  for (const date of events) {
    if (date.endsWith('-01') && date !== input.startDate && input.monthlyContribution > 0) {
      contributions += input.monthlyContribution;
      externalFlows.push({ date, amount: -input.monthlyContribution });
      transactions.push({ date, ticker: 'CASH', type: 'CONTRIBUTION', amount: input.monthlyContribution });
      buyHoldings(holdings, data, date, input.monthlyContribution, transactions);
    }

    while (dividendIndex < dividends.length && dividends[dividendIndex].date <= date) {
      const dividend = dividends[dividendIndex++];
      const holding = holdings.find(item => item.ticker === dividend.ticker);
      if (!holding || input.dividendMode === 'ignore') continue;

      const amount = holding.shares * dividend.value;
      if (amount > 0) pendingDividends.push({ dividend, amount });
    }

    for (let i = 0; i < pendingDividends.length;) {
      const { dividend, amount } = pendingDividends[i];
      if (dividend.paymentDate > date) {
        i++;
        continue;
      }

      pendingDividends.splice(i, 1);
      const holding = holdings.find(item => item.ticker === dividend.ticker);
      if (!holding) continue;

      holding.dividends += amount;
      totalDividends += amount;
      transactions.push({ date: dividend.paymentDate, ticker: dividend.ticker, type: 'DIVIDEND', amount });

      if (input.dividendMode === 'reinvest') {
        const price = priceOnOrBefore(data[dividend.ticker]?.prices ?? [], dividend.paymentDate);
        if (price > 0) {
          const shares = amount / price;
          holding.shares += shares;
          holding.reinvestedDividends += amount;
          totalReinvested += amount;
          transactions.push({ date: dividend.paymentDate, ticker: dividend.ticker, type: 'REINVEST', shares, price, amount });
        } else {
          cash += amount;
        }
      } else {
        cash += amount;
      }
    }

    const value = valueHoldings(holdings, data, date) + cash;
    if (series.at(-1)?.date !== date) series.push({ date, value, contributions, cash });
  }

  const holdingResults = toHoldingResults(holdings, data, input.endDate);
  const finalValue = holdingResults.reduce((sum, holding) => sum + holding.value, 0) + cash;
  const dividendTransactions = transactions.filter(transaction => transaction.type === 'DIVIDEND');
  const totalReturn = contributions ? ((finalValue - contributions) / contributions) * 100 : 0;
  const moneyWeightedAnnualizedReturn = moneyWeightedAnnualReturn([...externalFlows, { date: input.endDate, amount: finalValue }]);
  const timeWeightedAnnualizedReturn = timeWeightedAnnualReturn(series, input.startDate, input.endDate);
  const rankedHoldings = [...holdingResults].sort((a, b) => b.returnPct - a.returnPct);

  return {
    finalValue,
    totalReturn,
    cagr: moneyWeightedAnnualizedReturn,
    moneyWeightedAnnualizedReturn,
    timeWeightedAnnualizedReturn,
    totalDividends,
    totalDividendsReinvested: totalReinvested,
    annualDividendIncome: dividendTransactions.filter(transaction => transaction.date.slice(0, 4) === input.endDate.slice(0, 4)).reduce((sum, transaction) => sum + transaction.amount, 0),
    cashBalance: cash,
    holdings: holdingResults,
    transactions,
    dividends,
    series,
    allocation: holdingResults.map(holding => ({ ticker: holding.ticker, value: holding.value })),
    dividendsByYear: groupDividendsByYear(dividendTransactions),
    best: rankedHoldings[0],
    worst: rankedHoldings.at(-1)
  };
}

export function runSimulation(input: SimulationInput, data: MarketData): SimulationResult {
  return simulatePortfolioTimeline(input, data);
}

export async function simulate(input: SimulationInput) {
  return simulatePortfolioTimeline(input, await loadSimulationData(input));
}
