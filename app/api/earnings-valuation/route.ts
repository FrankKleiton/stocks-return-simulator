import { getHistoricalEarningsValuation } from '@/lib/fcfValuation';
import { statusInvestEarningsAdapter } from '@/lib/statusInvest';
import { BadRequestError, handleApiRequest } from '@/lib/apiRoute';
export async function GET(req: Request) {
  const ticker = new URL(req.url).searchParams.get('ticker');
  return handleApiRequest(async () => {
    if (!ticker) throw new BadRequestError('ticker is required');
    return getHistoricalEarningsValuation(ticker, statusInvestEarningsAdapter);
  });
}
