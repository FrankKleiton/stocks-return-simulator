import { NextResponse } from 'next/server';
import { getHistoricalFcfValuation } from '@/lib/fcfValuation';
import { statusInvestFcfAdapter } from '@/lib/statusInvest';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = url.searchParams.get('ticker');
  if (!ticker) return NextResponse.json({ error: 'ticker is required' }, { status: 400 });

  try {
    return NextResponse.json(await getHistoricalFcfValuation(ticker, statusInvestFcfAdapter));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to fetch FCF valuation' }, { status: 502 });
  }
}
