import { NextResponse } from 'next/server';
import { fetchStockList } from '@/lib/statusInvest';
import { getRecommendations } from '@/lib/scoring';
export async function GET(req: Request) { const u = new URL(req.url); const recommend = u.searchParams.get('recommend') === '1'; const limit = Number(u.searchParams.get('limit') || 80); return NextResponse.json(recommend ? await getRecommendations(limit) : await fetchStockList()); }
