import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearCache } from './cache';
import { UpstreamError } from './upstreamError';
import { chunkRange, conversionFactor, fetchUsdBrlRates, parseRates, rateOn } from './exchangeRates';

const jsonResponse = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => JSON.stringify(body) }) as unknown as Response;

beforeEach(() => clearCache());
afterEach(() => vi.restoreAllMocks());

describe('exchange rates (BCB PTAX)', () => {
  test('chunkRange splits long ranges into ten-year requests', () => {
    expect(chunkRange('2014-01-01', '2026-10-23')).toEqual([['2014-01-01', '2023-12-31'], ['2024-01-01', '2026-10-23']]);
    expect(chunkRange('2024-01-01', '2026-10-23')).toEqual([['2024-01-01', '2026-10-23']]);
  });

  test('parseRates converts dd/mm/yyyy rows, skips junk and sorts ascending', () => {
    expect(parseRates([{ data: '03/01/2014', valor: '2.3741' }, { data: '02/01/2014', valor: '2.3975' }, { data: 'x', valor: '1' }, { data: '06/01/2014', valor: 'abc' }])).toEqual([
      { date: '2014-01-02', price: 2.3975 }, { date: '2014-01-03', price: 2.3741 }
    ]);
  });

  test('rateOn uses the last published rate on or before the date', () => {
    const rates = [{ date: '2024-01-02', price: 4.9 }, { date: '2024-01-05', price: 5.1 }];
    expect(rateOn(rates, '2024-01-01')).toBe(4.9);
    expect(rateOn(rates, '2024-01-04')).toBe(4.9);
    expect(rateOn(rates, '2024-01-06')).toBe(5.1);
  });

  test('conversionFactor multiplies US$ into R$ and divides the other way', () => {
    expect(conversionFactor('USD', 'BRL', 5)).toBe(5);
    expect(conversionFactor('BRL', 'USD', 5)).toBe(0.2);
    expect(conversionFactor('BRL', 'BRL', 5)).toBe(1);
  });

  test('fetchUsdBrlRates fetches each chunk once, pads the start and caches the merged series', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = String(input);
      if (url.includes('dataInicial=22/12/2013')) return jsonResponse([{ data: '02/01/2014', valor: '2.3975' }]);
      if (url.includes('dataInicial=01/01/2023&dataFinal=30/06/2024')) return jsonResponse([{ data: '02/01/2024', valor: '4.8916' }]);
      throw new Error(`unexpected ${url}`);
    });
    const rates = await fetchUsdBrlRates('2014-01-01', '2024-06-30');
    expect(rates).toEqual([{ date: '2014-01-02', price: 2.3975 }, { date: '2024-01-02', price: 4.8916 }]);
    await fetchUsdBrlRates('2014-01-01', '2024-06-30');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('failures name the Central Bank, not Investidor10', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ message: 'nope' }, 406));
    const error = await fetchUsdBrlRates('2024-01-01', '2024-06-30').catch(e => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error.userMessage).toContain('Banco Central');
  });
});
