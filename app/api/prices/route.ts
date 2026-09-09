import { fetchPrices } from '@/lib/statusInvest';
import { BadRequestError, handleApiRequest } from '@/lib/apiRoute';
export async function GET(req: Request) {
  const u = new URL(req.url);
  const ticker = u.searchParams.get('ticker') || '';
  return handleApiRequest(async () => {
    if (!ticker) throw new BadRequestError('ticker is required');
    return fetchPrices(ticker, u.searchParams.get('start') || undefined, u.searchParams.get('end') || undefined);
  });
}
