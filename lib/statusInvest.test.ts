import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchAnnualFcf, parseAnnualFcfFromCashFlowResponse } from './statusInvest';

afterEach(() => vi.restoreAllMocks());

describe('StatusInvest cash-flow FCF parser', () => {
  test('fetches annual FCF from StatusInvest getfluxocaixa endpoint without caching', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          grid: [
            { isHeader: true, columns: [{ value: '#' }, { value: '2024' }] },
            { columns: [{ value: 'Fluxo de Caixa Livre - (R$)' }, { value: '1,00 M' }] }
          ]
        }
      })
    } as Response);

    await expect(fetchAnnualFcf('VALE3')).resolves.toEqual([{ year: 2024, fcf: 1000000 }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/acao/getfluxocaixa?');
    expect(String(url)).toContain('code=vale3');
    expect(String(url)).toContain('type=0');
    expect(String(url)).toContain('futureData=false');
    expect(String(url)).toContain('range.min=1900');
    expect(init).toMatchObject({ cache: 'no-store' });
  });

  test('extracts annual free cash flow from getfluxocaixa grid response', () => {
    const response = {
      success: true,
      data: {
        grid: [
          {
            isHeader: true,
            columns: [
              { value: '#' },
              { name: 'DATA', value: '2025' },
              { name: 'AH', value: 'AH' },
              { name: 'DATA', value: '2024' },
              { name: 'AH', value: 'AH' },
              { name: 'DATA', value: '2023' }
            ]
          },
          {
            columns: [
              { value: 'Fluxo de Caixa Livre - (R$)' },
              { value: '10.302,00 M' },
              { value: '-46,95' },
              { value: '19.418,00 M' },
              { value: '-43,68' },
              { value: '-1.234,56 M' }
            ]
          }
        ]
      }
    };

    expect(parseAnnualFcfFromCashFlowResponse(response)).toEqual([
      { year: 2023, fcf: -1234560000 },
      { year: 2024, fcf: 19418000000 },
      { year: 2025, fcf: 10302000000 }
    ]);
  });
});
