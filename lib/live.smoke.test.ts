import { describe, expect, test } from 'vitest';
import { fetchAnnualEarnings, fetchCompany, fetchIndicators, fetchPrices, fetchStockList } from './investidor10';
import { writeFileSync } from 'node:fs';
const out: string[] = [];
const log = (...a: unknown[]) => out.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '));
const OUT = '/private/tmp/claude-501/-Users-advise-Projects-stock-market/0189aecd-209a-4672-92cc-be38bd2ad289/scratchpad/i10/live-results.txt';
describe('live investidor10 smoke', () => {
  test('bbas3 end to end', async () => {
    try {
      const company = await fetchCompany('bbas3');
      log('COMPANY', { ...company, dividends: company.dividends.length }, [company.dividends[0], company.dividends.at(-1)]);
      const prices = await fetchPrices('BBAS3', '2024-01-01', '2024-01-10');
      log('PRICES', prices.length, prices.slice(0, 3));
      const all = await fetchPrices('BBAS3');
      log('ALL PRICES', all.length, [all[0], all.at(-1)]);
      log('INDICATORS', await fetchIndicators('BBAS3'));
      log('EARNINGS', await fetchAnnualEarnings('BBAS3'));
      log('VALE IND', (await fetchIndicators('VALE3')).slice(-2));
      log('UNKNOWN', await fetchCompany('XYZW9').catch(e => `${e.status} ${e.userMessage}`));
      const t0 = Date.now();
      const list = await fetchStockList();
      log('LIST', list.length, 'ms', Date.now() - t0, list.slice(0, 3), 'with roic', list.filter(s => s.roic > 0).length, 'with evEbit', list.filter(s => s.evEbit > 0).length, 'last', list.at(-1));
      expect(list.length).toBeGreaterThan(100);
    } catch (e) { log('ERROR', e instanceof Error ? e.message : String(e)); throw e; } finally { writeFileSync(OUT, out.join('\n')); }
  }, 600000);
});
