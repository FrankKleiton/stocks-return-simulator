import { describe, expect, test } from 'vitest';
import { getHistoricalEarningsValuation } from './earningsValuation';

describe('historical earnings valuation', () => {
  test('computes an available valuation from positive annual net income data', async () => {
    const valuation = await getHistoricalEarningsValuation('abcd3', {
      fetchAnnualEarnings: async () => [
        { year: 2021, earnings: 100 },
        { year: 2022, earnings: 140 },
        { year: 2023, earnings: 180 }
      ]
    });

    expect(valuation).toEqual({
      ticker: 'ABCD3',
      status: 'available',
      selectedAnnualEarnings: [
        { year: 2021, earnings: 100 },
        { year: 2022, earnings: 140 },
        { year: 2023, earnings: 180 }
      ],
      normalizedEarnings: 140,
      coefficientOfVariation: 0.23,
      volatility: 'medium',
      warnings: [
        { code: 'limited_history', message: 'valuation uses fewer than 10 annual earnings values' },
        { code: 'volatile_earnings_history', message: 'selected earnings history is volatile' }
      ],
      scenarios: {
        conservative: { earningsYield: 0.1, companyValue: 1400 },
        base: { earningsYield: 0.08, companyValue: 1750 },
        optimistic: { earningsYield: 0.06, companyValue: 2333.33 }
      }
    });
  });

  test('uses the latest 10 annual earnings values by default', async () => {
    const valuation = await getHistoricalEarningsValuation('WXYZ4', {
      fetchAnnualEarnings: async () => Array.from({ length: 12 }, (_, i) => ({ year: 2012 + i, earnings: (i + 1) * 10 }))
    });

    expect(valuation.status).toBe('available');
    expect(valuation.selectedAnnualEarnings).toEqual([
      { year: 2014, earnings: 30 },
      { year: 2015, earnings: 40 },
      { year: 2016, earnings: 50 },
      { year: 2017, earnings: 60 },
      { year: 2018, earnings: 70 },
      { year: 2019, earnings: 80 },
      { year: 2020, earnings: 90 },
      { year: 2021, earnings: 100 },
      { year: 2022, earnings: 110 },
      { year: 2023, earnings: 120 }
    ]);
    expect(valuation.normalizedEarnings).toBe(75);
  });

  test('keeps valuation available with fewer than 10 positive normalized earnings years and warns about limited history', async () => {
    const valuation = await getHistoricalEarningsValuation('SHORT3', {
      fetchAnnualEarnings: async () => [
        { year: 2021, earnings: 90 },
        { year: 2022, earnings: 100 },
        { year: 2023, earnings: 110 }
      ]
    });

    expect(valuation.status).toBe('available');
    expect(valuation.selectedAnnualEarnings).toEqual([
      { year: 2021, earnings: 90 },
      { year: 2022, earnings: 100 },
      { year: 2023, earnings: 110 }
    ]);
    expect(valuation.normalizedEarnings).toBe(100);
    expect(valuation.warnings).toContainEqual({ code: 'limited_history', message: 'valuation uses fewer than 10 annual earnings values' });
  });

  test('classifies volatility at PRD threshold boundaries', async () => {
    await expect(getHistoricalEarningsValuation('LOW3', { fetchAnnualEarnings: async () => [{ year: 2022, earnings: 80 }, { year: 2023, earnings: 120 }] })).resolves.toMatchObject({ coefficientOfVariation: 0.2, volatility: 'low' });
    await expect(getHistoricalEarningsValuation('MED3', { fetchAnnualEarnings: async () => [{ year: 2022, earnings: 50 }, { year: 2023, earnings: 150 }] })).resolves.toMatchObject({ coefficientOfVariation: 0.5, volatility: 'medium' });
    await expect(getHistoricalEarningsValuation('HIGH3', { fetchAnnualEarnings: async () => [{ year: 2022, earnings: 0 }, { year: 2023, earnings: 200 }] })).resolves.toMatchObject({ coefficientOfVariation: 1, volatility: 'high' });
    await expect(getHistoricalEarningsValuation('VHIGH3', { fetchAnnualEarnings: async () => [{ year: 2022, earnings: -10 }, { year: 2023, earnings: 210 }] })).resolves.toMatchObject({ coefficientOfVariation: 1.1, volatility: 'very_high' });
  });

  test('adds a volatility warning only when CV is greater than 20%', async () => {
    const low = await getHistoricalEarningsValuation('LOW3', { fetchAnnualEarnings: async () => [{ year: 2022, earnings: 80 }, { year: 2023, earnings: 120 }] });
    const medium = await getHistoricalEarningsValuation('MED3', { fetchAnnualEarnings: async () => [{ year: 2022, earnings: 50 }, { year: 2023, earnings: 150 }] });

    expect(low.warnings).not.toContainEqual({ code: 'volatile_earnings_history', message: 'selected earnings history is volatile' });
    expect(medium.warnings).toContainEqual({ code: 'volatile_earnings_history', message: 'selected earnings history is volatile' });
  });

  test('returns unavailable when earnings data cannot be fetched', async () => {
    const valuation = await getHistoricalEarningsValuation('FAIL3', {
      fetchAnnualEarnings: async () => { throw new Error('upstream timeout'); }
    });

    expect(valuation).toMatchObject({
      ticker: 'FAIL3',
      status: 'unavailable',
      reason: 'could_not_fetch_earnings_data',
      message: 'could not fetch earnings data',
      selectedAnnualEarnings: [],
      normalizedEarnings: 0
    });
  });

  test('returns unavailable when normalized earnings is zero', async () => {
    const valuation = await getHistoricalEarningsValuation('ZERO3', {
      fetchAnnualEarnings: async () => [
        { year: 2021, earnings: 100 },
        { year: 2022, earnings: -100 }
      ]
    });

    expect(valuation).toMatchObject({
      ticker: 'ZERO3',
      status: 'unavailable',
      reason: 'normalized_earnings_is_negative_or_zero',
      message: 'normalized earnings is negative or zero',
      normalizedEarnings: 0
    });
  });

  test('returns unavailable when normalized earnings is negative', async () => {
    const valuation = await getHistoricalEarningsValuation('NEG3', {
      fetchAnnualEarnings: async () => [
        { year: 2021, earnings: -80 },
        { year: 2022, earnings: -40 }
      ]
    });

    expect(valuation).toMatchObject({
      ticker: 'NEG3',
      status: 'unavailable',
      reason: 'normalized_earnings_is_negative_or_zero',
      message: 'normalized earnings is negative or zero',
      normalizedEarnings: -60
    });
  });
});
