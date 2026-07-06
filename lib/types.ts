export type DividendMode = 'ignore' | 'cash' | 'reinvest';

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

export interface PortfolioItem { ticker: string; name?: string; allocation: number }

export interface SimulationInput {
  holdings: PortfolioItem[];
  startDate: string;
  endDate: string;
  initialInvestment: number;
  monthlyContribution: number;
  dividendMode: DividendMode;
}

export interface Transaction { date: string; ticker: string; type: 'BUY' | 'DIVIDEND' | 'REINVEST' | 'CONTRIBUTION'; shares?: number; price?: number; amount: number }
export interface HoldingResult { ticker: string; shares: number; value: number; cost: number; returnPct: number; dividends: number }
export interface TimePoint { date: string; value: number; contributions: number; cash: number }
export interface SimulationResult {
  finalValue: number; totalReturn: number; cagr: number; moneyWeightedAnnualizedReturn: number; timeWeightedAnnualizedReturn: number; totalDividends: number; totalDividendsReinvested: number; annualDividendIncome: number; cashBalance: number;
  holdings: HoldingResult[]; transactions: Transaction[]; dividends: DividendPoint[]; series: TimePoint[]; allocation: { ticker: string; value: number }[]; dividendsByYear: { year: string; amount: number }[]; best?: HoldingResult; worst?: HoldingResult;
}
