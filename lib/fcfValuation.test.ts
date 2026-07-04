import { describe, expect, test } from 'vitest';
import { getHistoricalFcfValuation } from './fcfValuation';

describe('historical FCF valuation', () => {
  test('computes an available valuation from positive annual FCF data', async () => {
    const valuation = await getHistoricalFcfValuation('abcd3', {
      fetchAnnualFcf: async () => [
        { year: 2021, fcf: 100 },
        { year: 2022, fcf: 140 },
        { year: 2023, fcf: 180 }
      ]
    });

    expect(valuation).toEqual({
      ticker: 'ABCD3',
      status: 'available',
      selectedAnnualFcf: [
        { year: 2021, fcf: 100 },
        { year: 2022, fcf: 140 },
        { year: 2023, fcf: 180 }
      ],
      normalizedFcf: 140,
      scenarios: {
        conservative: { fcfYield: 0.1, companyValue: 1400 },
        base: { fcfYield: 0.08, companyValue: 1750 },
        optimistic: { fcfYield: 0.06, companyValue: 2333.33 }
      }
    });
  });

  test('uses the latest 10 annual FCF values by default', async () => {
    const valuation = await getHistoricalFcfValuation('WXYZ4', {
      fetchAnnualFcf: async () => Array.from({ length: 12 }, (_, i) => ({ year: 2012 + i, fcf: (i + 1) * 10 }))
    });

    expect(valuation.status).toBe('available');
    expect(valuation.selectedAnnualFcf).toEqual([
      { year: 2014, fcf: 30 },
      { year: 2015, fcf: 40 },
      { year: 2016, fcf: 50 },
      { year: 2017, fcf: 60 },
      { year: 2018, fcf: 70 },
      { year: 2019, fcf: 80 },
      { year: 2020, fcf: 90 },
      { year: 2021, fcf: 100 },
      { year: 2022, fcf: 110 },
      { year: 2023, fcf: 120 }
    ]);
    expect(valuation.normalizedFcf).toBe(75);
  });

  test('returns unavailable when FCF data cannot be fetched', async () => {
    const valuation = await getHistoricalFcfValuation('FAIL3', {
      fetchAnnualFcf: async () => { throw new Error('upstream timeout'); }
    });

    expect(valuation).toMatchObject({
      ticker: 'FAIL3',
      status: 'unavailable',
      reason: 'could_not_fetch_free_cash_flow_data',
      message: 'could not fetch free cash flow data',
      selectedAnnualFcf: [],
      normalizedFcf: 0
    });
  });

  test('returns unavailable when normalized FCF is zero', async () => {
    const valuation = await getHistoricalFcfValuation('ZERO3', {
      fetchAnnualFcf: async () => [
        { year: 2021, fcf: 100 },
        { year: 2022, fcf: -100 }
      ]
    });

    expect(valuation).toMatchObject({
      ticker: 'ZERO3',
      status: 'unavailable',
      reason: 'normalized_fcf_is_negative_or_zero',
      message: 'normalized FCF is negative or zero',
      normalizedFcf: 0
    });
  });

  test('returns unavailable when normalized FCF is negative', async () => {
    const valuation = await getHistoricalFcfValuation('NEG3', {
      fetchAnnualFcf: async () => [
        { year: 2021, fcf: -80 },
        { year: 2022, fcf: -40 }
      ]
    });

    expect(valuation).toMatchObject({
      ticker: 'NEG3',
      status: 'unavailable',
      reason: 'normalized_fcf_is_negative_or_zero',
      message: 'normalized FCF is negative or zero',
      normalizedFcf: -60
    });
  });
});
