import { NextResponse } from 'next/server';
import { getHistoricalEarningsValuation } from '@/lib/fcfValuation';
import { statusInvestEarningsAdapter } from '@/lib/statusInvest';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = url.searchParams.get('ticker');
  if (!ticker) return NextResponse.json({ error: 'ticker is required' }, { status: 400 });

  try {
    return NextResponse.json(await getHistoricalEarningsValuation(ticker, statusInvestEarningsAdapter));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to fetch earnings valuation' }, { status: 502 });
  }
}
