import { normalizeTicker } from './statusInvest';

export interface AnnualFcfPoint {
  year: number;
  fcf: number;
}

export interface FcfDataAdapter {
  fetchAnnualFcf(ticker: string): Promise<AnnualFcfPoint[]>;
}

export type FcfValuationStatus = 'available' | 'unavailable';
export type FcfValuationUnavailableReason = 'could_not_fetch_free_cash_flow_data' | 'normalized_fcf_is_negative_or_zero';
export type FcfVolatility = 'low' | 'medium' | 'high' | 'very_high';
export type FcfValuationWarningCode = 'limited_history' | 'volatile_fcf_history';

export interface FcfValuationWarning {
  code: FcfValuationWarningCode;
  message: string;
}

export interface FcfValuationScenario {
  fcfYield: number;
  companyValue: number;
}

export interface HistoricalFcfValuation {
  ticker: string;
  status: FcfValuationStatus;
  reason?: FcfValuationUnavailableReason;
  message?: string;
  selectedAnnualFcf: AnnualFcfPoint[];
  normalizedFcf: number;
  coefficientOfVariation: number;
  volatility: FcfVolatility;
  warnings: FcfValuationWarning[];
  scenarios: {
    conservative: FcfValuationScenario;
    base: FcfValuationScenario;
    optimistic: FcfValuationScenario;
  };
}

const DEFAULT_YEARS = 10;
const SCENARIO_YIELDS = {
  conservative: 0.10,
  base: 0.08,
  optimistic: 0.06
} as const;

const round2 = (value: number) => Math.round(value * 100) / 100;
const standardDeviation = (values: number[]) => {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
};
const classifyVolatility = (coefficientOfVariation: number): FcfVolatility => {
  if (coefficientOfVariation <= 0.20) return 'low';
  if (coefficientOfVariation <= 0.50) return 'medium';
  if (coefficientOfVariation <= 1) return 'high';
  return 'very_high';
};
const emptyScenarios = () => ({
  conservative: { fcfYield: SCENARIO_YIELDS.conservative, companyValue: 0 },
  base: { fcfYield: SCENARIO_YIELDS.base, companyValue: 0 },
  optimistic: { fcfYield: SCENARIO_YIELDS.optimistic, companyValue: 0 }
});

export async function getHistoricalFcfValuation(ticker: string, adapter: FcfDataAdapter, years = DEFAULT_YEARS): Promise<HistoricalFcfValuation> {
  const normalizedTicker = normalizeTicker(ticker);
  let annualFcf: AnnualFcfPoint[];
  try {
    annualFcf = await adapter.fetchAnnualFcf(normalizedTicker);
  } catch {
    return {
      ticker: normalizedTicker,
      status: 'unavailable',
      reason: 'could_not_fetch_free_cash_flow_data',
      message: 'could not fetch free cash flow data',
      selectedAnnualFcf: [],
      normalizedFcf: 0,
      coefficientOfVariation: 0,
      volatility: 'low',
      warnings: [],
      scenarios: emptyScenarios()
    };
  }

  const selectedAnnualFcf = annualFcf
    .filter(point => Number.isFinite(point.year) && Number.isFinite(point.fcf))
    .sort((a, b) => a.year - b.year)
    .slice(-years);

  const fcfValues = selectedAnnualFcf.map(point => point.fcf);
  const normalizedFcf = selectedAnnualFcf.length ? round2(fcfValues.reduce((sum, fcf) => sum + fcf, 0) / selectedAnnualFcf.length) : 0;
  const coefficientOfVariation = normalizedFcf === 0 ? 0 : round2(standardDeviation(fcfValues) / Math.abs(normalizedFcf));
  const volatility = classifyVolatility(coefficientOfVariation);
  const warnings: FcfValuationWarning[] = [];
  if (selectedAnnualFcf.length > 0 && selectedAnnualFcf.length < DEFAULT_YEARS) warnings.push({ code: 'limited_history', message: 'valuation uses fewer than 10 annual FCF values' });
  if (coefficientOfVariation > 0.20) warnings.push({ code: 'volatile_fcf_history', message: 'selected FCF history is volatile' });
  const available = normalizedFcf > 0;

  if (!available) return {
    ticker: normalizedTicker,
    status: 'unavailable',
    reason: 'normalized_fcf_is_negative_or_zero',
    message: 'normalized FCF is negative or zero',
    selectedAnnualFcf,
    normalizedFcf,
    coefficientOfVariation,
    volatility,
    warnings,
    scenarios: emptyScenarios()
  };

  return {
    ticker: normalizedTicker,
    status: 'available',
    selectedAnnualFcf,
    normalizedFcf,
    coefficientOfVariation,
    volatility,
    warnings,
    scenarios: {
      conservative: { fcfYield: SCENARIO_YIELDS.conservative, companyValue: round2(normalizedFcf / SCENARIO_YIELDS.conservative) },
      base: { fcfYield: SCENARIO_YIELDS.base, companyValue: round2(normalizedFcf / SCENARIO_YIELDS.base) },
      optimistic: { fcfYield: SCENARIO_YIELDS.optimistic, companyValue: round2(normalizedFcf / SCENARIO_YIELDS.optimistic) }
    }
  };
}
