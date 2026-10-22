import { fetchDividends } from '@/lib/investidor10';
import { BadRequestError, handleApiRequest } from '@/lib/apiRoute';
export async function GET(req: Request) {
  const ticker = new URL(req.url).searchParams.get('ticker') || '';
  return handleApiRequest(async () => {
    if (!ticker) throw new BadRequestError('ticker is required');
    return fetchDividends(ticker);
  });
}
