import { normalizeTicker } from './statusInvest';

export interface AnnualFcfPoint {
  year: number;
  fcf: number;
}

export interface FcfDataAdapter {
  fetchAnnualFcf(ticker: string): Promise<AnnualFcfPoint[]>;
}

export type FcfValuationStatus = 'available' | 'unavailable';

export interface FcfValuationScenario {
  fcfYield: number;
  companyValue: number;
}

export interface HistoricalFcfValuation {
  ticker: string;
  status: FcfValuationStatus;
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

export async function getHistoricalFcfValuation(ticker: string, adapter: FcfDataAdapter, years = DEFAULT_YEARS): Promise<HistoricalFcfValuation> {
  const normalizedTicker = normalizeTicker(ticker);
  const annualFcf = await adapter.fetchAnnualFcf(normalizedTicker);
  const selectedAnnualFcf = annualFcf
    .filter(point => Number.isFinite(point.year) && Number.isFinite(point.fcf))
    .sort((a, b) => a.year - b.year)
    .slice(-years);

  const positiveFcf = selectedAnnualFcf.length > 0 && selectedAnnualFcf.every(point => point.fcf > 0);
  const normalizedFcf = positiveFcf ? round2(selectedAnnualFcf.reduce((sum, point) => sum + point.fcf, 0) / selectedAnnualFcf.length) : 0;

  return {
    ticker: normalizedTicker,
    status: positiveFcf ? 'available' : 'unavailable',
    selectedAnnualFcf,
    normalizedFcf,
    scenarios: {
      conservative: { fcfYield: SCENARIO_YIELDS.conservative, companyValue: positiveFcf ? round2(normalizedFcf / SCENARIO_YIELDS.conservative) : 0 },
      base: { fcfYield: SCENARIO_YIELDS.base, companyValue: positiveFcf ? round2(normalizedFcf / SCENARIO_YIELDS.base) : 0 },
      optimistic: { fcfYield: SCENARIO_YIELDS.optimistic, companyValue: positiveFcf ? round2(normalizedFcf / SCENARIO_YIELDS.optimistic) : 0 }
    }
  };
}
