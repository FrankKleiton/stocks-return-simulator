import { simulate } from '@/lib/simulator';
import type { SimulationInput } from '@/lib/types';
import { BadRequestError, handleApiRequest } from '@/lib/apiRoute';
export async function POST(req: Request) {
  return handleApiRequest(async () => {
    const input = await req.json() as SimulationInput;
    if (!Array.isArray(input?.holdings) || !input.holdings.length) throw new BadRequestError('A carteira precisa ter pelo menos uma ação.');
    const today = new Date().toISOString().slice(0, 10);
    if (input.startDate > today || input.endDate > today) throw new BadRequestError('Datas futuras não são permitidas em um back test.');
    if (input.startDate > input.endDate) throw new BadRequestError('A data inicial precisa ser anterior à data final.');
    return simulate(input);
  });
}
