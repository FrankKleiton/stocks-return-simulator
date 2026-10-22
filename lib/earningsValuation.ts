import { normalizeTicker } from './investidor10';

export interface AnnualEarningsPoint {
  year: number;
  earnings: number;
}

export interface EarningsDataAdapter {
  fetchAnnualEarnings(ticker: string): Promise<AnnualEarningsPoint[]>;
}

export type ValuationStatus = 'available' | 'unavailable';
export type EarningsValuationUnavailableReason = 'could_not_fetch_earnings_data' | 'normalized_earnings_is_negative_or_zero';
export type Volatility = 'low' | 'medium' | 'high' | 'very_high';
export type EarningsValuationWarningCode = 'limited_history' | 'volatile_earnings_history';

export interface EarningsValuationWarning {
  code: EarningsValuationWarningCode;
  message: string;
}

export interface EarningsValuationScenario {
  earningsYield: number;
  companyValue: number;
}

export interface HistoricalEarningsValuation {
  ticker: string;
  status: ValuationStatus;
  reason?: EarningsValuationUnavailableReason;
  message?: string;
  selectedAnnualEarnings: AnnualEarningsPoint[];
  normalizedEarnings: number;
  coefficientOfVariation: number;
  volatility: Volatility;
  warnings: EarningsValuationWarning[];
  scenarios: {
    conservative: EarningsValuationScenario;
    base: EarningsValuationScenario;
    optimistic: EarningsValuationScenario;
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
const classifyVolatility = (coefficientOfVariation: number): Volatility => {
  if (coefficientOfVariation <= 0.20) return 'low';
  if (coefficientOfVariation <= 0.50) return 'medium';
  if (coefficientOfVariation <= 1) return 'high';
  return 'very_high';
};
const emptyEarningsScenarios = () => ({
  conservative: { earningsYield: SCENARIO_YIELDS.conservative, companyValue: 0 },
  base: { earningsYield: SCENARIO_YIELDS.base, companyValue: 0 },
  optimistic: { earningsYield: SCENARIO_YIELDS.optimistic, companyValue: 0 }
});

interface HistoricalMetricCore<TPoint> {
  selected: TPoint[];
  normalizedValue: number;
  coefficientOfVariation: number;
  volatility: Volatility;
  hasLimitedHistory: boolean;
  isVolatile: boolean;
}

function computeHistoricalMetricCore<TPoint extends { year: number }>(points: TPoint[], getValue: (point: TPoint) => number, years: number): HistoricalMetricCore<TPoint> {
  const selected = points
    .filter(point => Number.isFinite(point.year) && Number.isFinite(getValue(point)))
    .sort((a, b) => a.year - b.year)
    .slice(-years);

  const values = selected.map(getValue);
  const normalizedValue = selected.length ? round2(values.reduce((sum, value) => sum + value, 0) / selected.length) : 0;
  const coefficientOfVariation = normalizedValue === 0 ? 0 : round2(standardDeviation(values) / Math.abs(normalizedValue));
  const volatility = classifyVolatility(coefficientOfVariation);
  const hasLimitedHistory = selected.length > 0 && selected.length < years;
  const isVolatile = coefficientOfVariation > 0.20;

  return { selected, normalizedValue, coefficientOfVariation, volatility, hasLimitedHistory, isVolatile };
}

const buildScenarioValues = (normalizedValue: number) => ({
  conservative: round2(normalizedValue / SCENARIO_YIELDS.conservative),
  base: round2(normalizedValue / SCENARIO_YIELDS.base),
  optimistic: round2(normalizedValue / SCENARIO_YIELDS.optimistic)
});

export async function getHistoricalEarningsValuation(ticker: string, adapter: EarningsDataAdapter, years = DEFAULT_YEARS): Promise<HistoricalEarningsValuation> {
  const normalizedTicker = normalizeTicker(ticker);
  let annualEarnings: AnnualEarningsPoint[];
  try {
    annualEarnings = await adapter.fetchAnnualEarnings(normalizedTicker);
  } catch {
    return {
      ticker: normalizedTicker,
      status: 'unavailable',
      reason: 'could_not_fetch_earnings_data',
      message: 'could not fetch earnings data',
      selectedAnnualEarnings: [],
      normalizedEarnings: 0,
      coefficientOfVariation: 0,
      volatility: 'low',
      warnings: [],
      scenarios: emptyEarningsScenarios()
    };
  }

  const core = computeHistoricalMetricCore(annualEarnings, point => point.earnings, years);
  const warnings: EarningsValuationWarning[] = [];
  if (core.hasLimitedHistory) warnings.push({ code: 'limited_history', message: 'valuation uses fewer than 10 annual earnings values' });
  if (core.isVolatile) warnings.push({ code: 'volatile_earnings_history', message: 'selected earnings history is volatile' });
  const available = core.normalizedValue > 0;

  if (!available) return {
    ticker: normalizedTicker,
    status: 'unavailable',
    reason: 'normalized_earnings_is_negative_or_zero',
    message: 'normalized earnings is negative or zero',
    selectedAnnualEarnings: core.selected,
    normalizedEarnings: core.normalizedValue,
    coefficientOfVariation: core.coefficientOfVariation,
    volatility: core.volatility,
    warnings,
    scenarios: emptyEarningsScenarios()
  };

  const scenarioValues = buildScenarioValues(core.normalizedValue);
  return {
    ticker: normalizedTicker,
    status: 'available',
    selectedAnnualEarnings: core.selected,
    normalizedEarnings: core.normalizedValue,
    coefficientOfVariation: core.coefficientOfVariation,
    volatility: core.volatility,
    warnings,
    scenarios: {
      conservative: { earningsYield: SCENARIO_YIELDS.conservative, companyValue: scenarioValues.conservative },
      base: { earningsYield: SCENARIO_YIELDS.base, companyValue: scenarioValues.base },
      optimistic: { earningsYield: SCENARIO_YIELDS.optimistic, companyValue: scenarioValues.optimistic }
    }
  };
}
