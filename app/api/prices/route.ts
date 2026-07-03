import { NextResponse } from 'next/server';
import { fetchPrices } from '@/lib/statusInvest';
export async function GET(req: Request) { const u = new URL(req.url); return NextResponse.json(await fetchPrices(u.searchParams.get('ticker') || '', u.searchParams.get('start') || undefined, u.searchParams.get('end') || undefined)); }
