import { NextResponse } from 'next/server';
import { fetchDividends } from '@/lib/statusInvest';
export async function GET(req: Request) { const u = new URL(req.url); return NextResponse.json(await fetchDividends(u.searchParams.get('ticker') || '')); }
