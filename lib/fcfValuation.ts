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
      scenarios: emptyScenarios()
    };
  }

  const selectedAnnualFcf = annualFcf
    .filter(point => Number.isFinite(point.year) && Number.isFinite(point.fcf))
    .sort((a, b) => a.year - b.year)
    .slice(-years);

  const normalizedFcf = selectedAnnualFcf.length ? round2(selectedAnnualFcf.reduce((sum, point) => sum + point.fcf, 0) / selectedAnnualFcf.length) : 0;
  const available = normalizedFcf > 0;

  if (!available) return {
    ticker: normalizedTicker,
    status: 'unavailable',
    reason: 'normalized_fcf_is_negative_or_zero',
    message: 'normalized FCF is negative or zero',
    selectedAnnualFcf,
    normalizedFcf,
    scenarios: emptyScenarios()
  };

  return {
    ticker: normalizedTicker,
    status: 'available',
    selectedAnnualFcf,
    normalizedFcf,
    scenarios: {
      conservative: { fcfYield: SCENARIO_YIELDS.conservative, companyValue: round2(normalizedFcf / SCENARIO_YIELDS.conservative) },
      base: { fcfYield: SCENARIO_YIELDS.base, companyValue: round2(normalizedFcf / SCENARIO_YIELDS.base) },
      optimistic: { fcfYield: SCENARIO_YIELDS.optimistic, companyValue: round2(normalizedFcf / SCENARIO_YIELDS.optimistic) }
    }
  };
}
