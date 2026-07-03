import { NextResponse } from 'next/server';
import { fetchIndicators } from '@/lib/statusInvest';
export async function GET(req: Request) { const u = new URL(req.url); return NextResponse.json(await fetchIndicators(u.searchParams.get('ticker') || '')); }
