import { fetchCompany, fetchDividends, fetchPrices } from './investidor10';
import { conversionFactor, EXCHANGE_RATE_SOURCE, fetchUsdBrlRates, rateOn } from './exchangeRates';
import type { Currency, DividendPoint, ExchangeRateInfo, HoldingResult, PortfolioItem, PricePoint, SimulationInput, SimulationResult, TimePoint, Transaction } from './types';

/**
 * Per-ticker prices and dividends, already expressed in the simulation's reporting currency. `currency` is the
 * currency the asset is quoted in and `nativePrices` its unconverted series; both default to the reporting currency.
 */
export type MarketData = Record<string, { prices: PricePoint[]; dividends: DividendPoint[]; currency?: Currency; nativePrices?: PricePoint[] }>;

const DEFAULT_CURRENCY: Currency = 'BRL';
const reportingCurrency = (input: Pick<SimulationInput, 'currency'>) => input.currency ?? DEFAULT_CURRENCY;
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

/** Payouts whose data-com falls in the period; payments announced for after the end date never happen in the simulation, so they are left out. */
function collectDividends(input: SimulationInput, data: MarketData) {
  return Object.values(data)
    .flatMap(item => item.dividends)
    .filter(dividend => within(dividend.date, input.startDate, input.endDate) && dividend.paymentDate <= input.endDate)
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

function toHoldingResults(holdings: SimHolding[], data: MarketData, endDate: string, currency: Currency): HoldingResult[] {
  return holdings.map(holding => {
    const market = data[holding.ticker];
    const value = holding.shares * priceOnOrBefore(market?.prices ?? [], endDate);
    const nativeValue = market?.nativePrices ? holding.shares * priceOnOrBefore(market.nativePrices, endDate) : value;
    const returnPct = holding.cost ? ((value + holding.dividends - holding.reinvestedDividends - holding.cost) / holding.cost) * 100 : 0;
    return { ticker: holding.ticker, shares: holding.shares, value, cost: holding.cost, returnPct, dividends: holding.dividends, currency: market?.currency ?? currency, nativeValue };
  });
}

function groupDividendsByYear(transactions: Transaction[]) {
  return Object.entries(transactions.reduce<Record<string, number>>((acc, transaction) => {
    const year = transaction.date.slice(0, 4);
    acc[year] = (acc[year] ?? 0) + transaction.amount;
    return acc;
  }, {})).map(([year, amount]) => ({ year, amount }));
}

/**
 * Expresses every asset in the reporting currency. Prices are converted at each day's rate and dividends at the
 * rate of their payment date, so the simulation itself never has to know about currencies.
 */
export function convertMarketData(data: MarketData, currency: Currency, usdBrl: PricePoint[]): MarketData {
  return Object.fromEntries(Object.entries(data).map(([ticker, market]) => {
    const from = market.currency ?? currency;
    if (from === currency) return [ticker, { ...market, currency: from }];
    const factor = (date: string) => conversionFactor(from, currency, rateOn(usdBrl, date));
    return [ticker, {
      currency: from,
      nativePrices: market.prices,
      prices: market.prices.map(point => ({ ...point, price: point.price * factor(point.date) })),
      dividends: market.dividends.map(dividend => ({ ...dividend, value: dividend.value * factor(dividend.paymentDate) }))
    }];
  }));
}

export async function loadSimulationData(input: SimulationInput): Promise<{ data: MarketData; exchangeRate?: ExchangeRateInfo }> {
  const currency = reportingCurrency(input);
  const tickers = [...new Set(input.holdings.map(holding => holding.ticker.toUpperCase()))];
  const entries = await Promise.all(tickers.map(async ticker => {
    const company = await fetchCompany(ticker);
    return [ticker, { currency: company.currency, prices: await fetchPrices(ticker, input.startDate, input.endDate), dividends: await fetchDividends(ticker) }] as const;
  }));
  const native: MarketData = Object.fromEntries(entries);
  if (!Object.values(native).some(market => market.currency !== currency)) return { data: native };

  const usdBrl = await fetchUsdBrlRates(input.startDate, input.endDate);
  const quote = (date: string) => conversionFactor('USD', currency === 'USD' ? 'BRL' : 'USD', rateOn(usdBrl, date));
  // The rate is reported the way Brazilians read it (R$ per US$) when reporting in R$, and US$ per R$ otherwise.
  const exchangeRate: ExchangeRateInfo = currency === 'BRL'
    ? { base: 'USD', quote: 'BRL', atStart: rateOn(usdBrl, input.startDate), atEnd: rateOn(usdBrl, input.endDate), source: EXCHANGE_RATE_SOURCE }
    : { base: 'BRL', quote: 'USD', atStart: quote(input.startDate), atEnd: quote(input.endDate), source: EXCHANGE_RATE_SOURCE };
  return { data: convertMarketData(native, currency, usdBrl), exchangeRate };
}

export function simulatePortfolioTimeline(input: SimulationInput, data: MarketData, exchangeRate?: ExchangeRateInfo): SimulationResult {
  const currency = reportingCurrency(input);
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

  const holdingResults = toHoldingResults(holdings, data, input.endDate, currency);
  const finalValue = holdingResults.reduce((sum, holding) => sum + holding.value, 0) + cash;
  const dividendTransactions = transactions.filter(transaction => transaction.type === 'DIVIDEND');
  const totalReturn = contributions ? ((finalValue - contributions) / contributions) * 100 : 0;
  const moneyWeightedAnnualizedReturn = moneyWeightedAnnualReturn([...externalFlows, { date: input.endDate, amount: finalValue }]);
  const timeWeightedAnnualizedReturn = timeWeightedAnnualReturn(series, input.startDate, input.endDate);
  const rankedHoldings = [...holdingResults].sort((a, b) => b.returnPct - a.returnPct);
  // The end year is usually partial, so the last complete calendar year is the one before it.
  const lastFullYear = String(Number(input.endDate.slice(0, 4)) - 1);

  return {
    totalInvested: contributions,
    finalValue,
    totalReturn,
    cagr: moneyWeightedAnnualizedReturn,
    moneyWeightedAnnualizedReturn,
    timeWeightedAnnualizedReturn,
    totalDividends,
    totalDividendsReinvested: totalReinvested,
    // Average over the simulated period; periods under a year are not annualised so a short back test cannot extrapolate.
    annualDividendIncome: totalDividends / Math.max(1, yearsBetween(input.startDate, input.endDate)),
    lastFullYear,
    lastFullYearDividendIncome: dividendTransactions.filter(transaction => transaction.date.slice(0, 4) === lastFullYear).reduce((sum, transaction) => sum + transaction.amount, 0),
    cashBalance: cash,
    holdings: holdingResults,
    transactions,
    dividends,
    series,
    allocation: holdingResults.map(holding => ({ ticker: holding.ticker, value: holding.value })),
    dividendsByYear: groupDividendsByYear(dividendTransactions),
    best: rankedHoldings[0],
    worst: rankedHoldings.at(-1),
    currency,
    exchangeRate
  };
}

export function runSimulation(input: SimulationInput, data: MarketData, exchangeRate?: ExchangeRateInfo): SimulationResult {
  return simulatePortfolioTimeline(input, data, exchangeRate);
}

export async function simulate(input: SimulationInput) {
  const { data, exchangeRate } = await loadSimulationData(input);
  return simulatePortfolioTimeline(input, data, exchangeRate);
}
