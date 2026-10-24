import type { Currency } from './types';

export const avg = (xs: number[]) => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : 0;
export const stdev = (xs: number[]) => { const m = avg(xs); return xs.length ? Math.sqrt(avg(xs.map(x => (x-m)**2))) : 0; };
export const clamp = (x: number, min=0, max=100) => Math.max(min, Math.min(max, x));
export function cagr(start: number, end: number, years: number) { return start > 0 && end > 0 && years > 0 ? (Math.pow(end/start, 1/years)-1)*100 : 0; }
export function pct(n: number) { return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`; }
export const currencySymbol = (currency: Currency) => (currency === 'USD' ? 'US$' : 'R$');
/** Amount in the given currency, pt-BR style: "R$ 1.234,56" or "US$ 1.234,56". */
export function money(n: number, currency: Currency = 'BRL') { return n.toLocaleString('pt-BR', { style: 'currency', currency }); }
export const brl = (n: number) => money(n, 'BRL');
/** Short currency for chart axes: "R$ 250 mil", "US$ 1,2 mi". */
export function moneyCompact(n: number, currency: Currency = 'BRL') { return n.toLocaleString('pt-BR', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }); }
export function quantity(n: number) { return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }); }
/** ISO date (YYYY-MM-DD) as dd/mm/yyyy; anything else is returned untouched. */
export function brDate(iso: string) { const [y, m, d] = iso.slice(0, 10).split('-'); return y && m && d ? `${d}/${m}/${y}` : iso; }
const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
/** ISO date as "jan/24" for dense chart axes. */
export function monthYear(iso: string) { const [y, m] = iso.slice(0, 10).split('-'); return y && m ? `${monthNames[Number(m) - 1] ?? m}/${y.slice(2)}` : iso; }
