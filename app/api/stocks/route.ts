import { fetchStockList } from '@/lib/statusInvest';
import { getRecommendations } from '@/lib/scoring';
import { handleApiRequest } from '@/lib/apiRoute';
export async function GET(req: Request) {
  const u = new URL(req.url);
  const recommend = u.searchParams.get('recommend') === '1';
  const limit = Number(u.searchParams.get('limit') || 80);
  return handleApiRequest(() => recommend ? getRecommendations(limit) : fetchStockList());
}
