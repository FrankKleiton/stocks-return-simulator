import { NextResponse } from 'next/server';
import { simulate } from '@/lib/simulator';
import type { SimulationInput } from '@/lib/types';
export async function POST(req: Request) { const input = await req.json() as SimulationInput; return NextResponse.json(await simulate(input)); }
