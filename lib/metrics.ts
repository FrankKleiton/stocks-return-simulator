export const avg = (xs: number[]) => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : 0;
export const stdev = (xs: number[]) => { const m = avg(xs); return xs.length ? Math.sqrt(avg(xs.map(x => (x-m)**2))) : 0; };
export const clamp = (x: number, min=0, max=100) => Math.max(min, Math.min(max, x));
export function cagr(start: number, end: number, years: number) { return start > 0 && end > 0 && years > 0 ? (Math.pow(end/start, 1/years)-1)*100 : 0; }
export function pct(n: number) { return `${n.toFixed(2)}%`; }
export function brl(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
