export type DividendMode = 'ignore' | 'cash' | 'reinvest';
/** Currency an asset is quoted in (B3 assets in BRL; US stocks and foreign ETFs in USD) or a simulation is reported in. */
export type Currency = 'BRL' | 'USD';
/** What the UI needs to know about a ticker before simulating it. */
export interface AssetInfo { ticker: string; name: string; kind: string; currency: Currency }

export interface StockSummary {
  ticker: string;
  companyName: string;
  industry: string;
  sector?: string;
  price: number;
  dy: number;
  pL: number;
  evEbit: number;
  roe: number;
  roic: number;
  pVp: number;
  debtEquity: number;
  revenueCagr5: number;
  earningsCagr5: number;
  liquidity: number;
}

export interface PricePoint { date: string; price: number }
export interface IndicatorPoint { year: number; roe?: number; roic?: number; pVp?: number; revenue?: number; earnings?: number; debtEquity?: number; currentRatio?: number }
export interface DividendPoint { ticker: string; date: string; paymentDate: string; value: number; type?: string }

export interface Recommendation extends StockSummary {
  qualityScore: number;
  valuationScore: number;
  magicFormulaScore: number;
  earningsYield: number;
  averageRoe: number;
  averageRoic: number;
  averagePVp: number;
  averageDividendYield: number;
  yearsPayingDividends: number;
  earningsCagr: number;
}

export interface PortfolioItem { ticker: string; name?: string; allocation: number; currency?: Currency }

export interface SimulationInput {
  holdings: PortfolioItem[];
  startDate: string;
  endDate: string;
  initialInvestment: number;
  monthlyContribution: number;
  dividendMode: DividendMode;
  /** Currency the results are reported in; assets quoted in another currency are converted at the daily PTAX rate. Defaults to BRL. */
  currency?: Currency;
}

export interface Transaction { date: string; ticker: string; type: 'BUY' | 'DIVIDEND' | 'REINVEST' | 'CONTRIBUTION'; shares?: number; price?: number; amount: number }
export interface HoldingResult {
  ticker: string; shares: number; value: number; cost: number; returnPct: number; dividends: number;
  /** Currency the asset is quoted in, and its final value in that currency (equal to `value` when no conversion applied). */
  currency: Currency; nativeValue: number;
}
/** Exchange rate applied when the portfolio mixes currencies: units of `quote` per one unit of `base`. */
export interface ExchangeRateInfo { base: Currency; quote: Currency; atStart: number; atEnd: number; source: string }
export interface TimePoint { date: string; value: number; contributions: number; cash: number }
export interface SimulationResult {
  /** Initial investment plus every monthly contribution made during the period. */
  totalInvested: number; finalValue: number; totalReturn: number; cagr: number; moneyWeightedAnnualizedReturn: number; timeWeightedAnnualizedReturn: number; totalDividends: number; totalDividendsReinvested: number; annualDividendIncome: number; lastFullYear: string; lastFullYearDividendIncome: number; cashBalance: number;
  holdings: HoldingResult[]; transactions: Transaction[]; dividends: DividendPoint[]; series: TimePoint[]; allocation: { ticker: string; value: number }[]; dividendsByYear: { year: string; amount: number }[]; best?: HoldingResult; worst?: HoldingResult;
  /** Currency every amount above is expressed in. */
  currency: Currency;
  /** Present when at least one asset was converted into `currency`. */
  exchangeRate?: ExchangeRateInfo;
}
