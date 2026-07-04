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
      coefficientOfVariation: 0.23,
      volatility: 'medium',
      warnings: [
        { code: 'limited_history', message: 'valuation uses fewer than 10 annual FCF values' },
        { code: 'volatile_fcf_history', message: 'selected FCF history is volatile' }
      ],
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

  test('keeps valuation available with fewer than 10 positive normalized FCF years and warns about limited history', async () => {
    const valuation = await getHistoricalFcfValuation('SHORT3', {
      fetchAnnualFcf: async () => [
        { year: 2021, fcf: 90 },
        { year: 2022, fcf: 100 },
        { year: 2023, fcf: 110 }
      ]
    });

    expect(valuation.status).toBe('available');
    expect(valuation.selectedAnnualFcf).toEqual([
      { year: 2021, fcf: 90 },
      { year: 2022, fcf: 100 },
      { year: 2023, fcf: 110 }
    ]);
    expect(valuation.normalizedFcf).toBe(100);
    expect(valuation.warnings).toContainEqual({ code: 'limited_history', message: 'valuation uses fewer than 10 annual FCF values' });
  });

  test('classifies volatility at PRD threshold boundaries', async () => {
    await expect(getHistoricalFcfValuation('LOW3', { fetchAnnualFcf: async () => [{ year: 2022, fcf: 80 }, { year: 2023, fcf: 120 }] })).resolves.toMatchObject({ coefficientOfVariation: 0.2, volatility: 'low' });
    await expect(getHistoricalFcfValuation('MED3', { fetchAnnualFcf: async () => [{ year: 2022, fcf: 50 }, { year: 2023, fcf: 150 }] })).resolves.toMatchObject({ coefficientOfVariation: 0.5, volatility: 'medium' });
    await expect(getHistoricalFcfValuation('HIGH3', { fetchAnnualFcf: async () => [{ year: 2022, fcf: 0 }, { year: 2023, fcf: 200 }] })).resolves.toMatchObject({ coefficientOfVariation: 1, volatility: 'high' });
    await expect(getHistoricalFcfValuation('VHIGH3', { fetchAnnualFcf: async () => [{ year: 2022, fcf: -10 }, { year: 2023, fcf: 210 }] })).resolves.toMatchObject({ coefficientOfVariation: 1.1, volatility: 'very_high' });
  });

  test('adds a volatility warning only when CV is greater than 20%', async () => {
    const low = await getHistoricalFcfValuation('LOW3', { fetchAnnualFcf: async () => [{ year: 2022, fcf: 80 }, { year: 2023, fcf: 120 }] });
    const medium = await getHistoricalFcfValuation('MED3', { fetchAnnualFcf: async () => [{ year: 2022, fcf: 50 }, { year: 2023, fcf: 150 }] });

    expect(low.warnings).not.toContainEqual({ code: 'volatile_fcf_history', message: 'selected FCF history is volatile' });
    expect(medium.warnings).toContainEqual({ code: 'volatile_fcf_history', message: 'selected FCF history is volatile' });
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

  test('does not return v1 recommendation precision outputs', async () => {
    const valuation = await getHistoricalFcfValuation('SAFE3', {
      fetchAnnualFcf: async () => [
        { year: 2022, fcf: 100 },
        { year: 2023, fcf: 100 }
      ]
    });

    expect(valuation.status).toBe('available');
    expect(valuation).not.toHaveProperty('recommendation');
    expect(valuation).not.toHaveProperty('rating');
    expect(valuation).not.toHaveProperty('buyHoldSell');
    expect(valuation).not.toHaveProperty('fairValuePerShare');
    expect(valuation).not.toHaveProperty('targetPrice');
    expect(valuation).not.toHaveProperty('marketCapComparison');
    expect(valuation).not.toHaveProperty('netDebtAdjustedEquityValue');
  });
});
