'use client';
import { Button, Card, NumberInput, Select, SimpleGrid, Stack, TextInput, Title } from '@mantine/core';
import type { DividendMode, PortfolioItem, SimulationInput, SimulationResult } from '@/lib/types';

export default function SimulationForm({ holdings, onResult }: { holdings: PortfolioItem[]; onResult: (r: SimulationResult) => void }) {
  async function submit(form: FormData) {
    const input: SimulationInput = { holdings, startDate: String(form.get('startDate')), endDate: String(form.get('endDate')), initialInvestment: Number(form.get('initialInvestment')), monthlyContribution: Number(form.get('monthlyContribution')), dividendMode: String(form.get('dividendMode')) as DividendMode };
    const res = await fetch('/api/simulate', { method: 'POST', body: JSON.stringify(input) });
    if (!res.ok) throw new Error('Simulation failed');
    onResult(await res.json());
  }
  return <Card withBorder shadow="md" radius="lg" p={{ base: 'sm', sm: 'md' }}>
    <Stack gap="md"><Title order={2} fz={{ base: 'lg', sm: 'xl' }}>Historical simulator</Title>
      <form action={submit}><Stack gap="sm"><SimpleGrid cols={{ base: 1, sm: 2, lg: 1 }} spacing="sm"><TextInput label="Start date" name="startDate" type="date" defaultValue="2014-01-01"/><TextInput label="End date" name="endDate" type="date" defaultValue={new Date().toISOString().slice(0,10)}/><NumberInput label="Initial investment" name="initialInvestment" defaultValue={10000} min={0}/><NumberInput label="Monthly contribution" name="monthlyContribution" defaultValue={500} min={0}/></SimpleGrid><Select label="Dividends" name="dividendMode" defaultValue="reinvest" data={[{ value: 'ignore', label: 'Ignore dividends' }, { value: 'cash', label: 'Receive as cash' }, { value: 'reinvest', label: 'Accumulate as cash' }]}/><Button type="submit" fullWidth disabled={!holdings.length}>Run simulation</Button></Stack></form>
    </Stack>
  </Card>;
}
