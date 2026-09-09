import { simulate } from '@/lib/simulator';
import type { SimulationInput } from '@/lib/types';
import { BadRequestError, handleApiRequest } from '@/lib/apiRoute';
export async function POST(req: Request) {
  return handleApiRequest(async () => {
    const input = await req.json() as SimulationInput;
    if (!Array.isArray(input?.holdings) || !input.holdings.length) throw new BadRequestError('A carteira precisa ter pelo menos uma ação.');
    return simulate(input);
  });
}
