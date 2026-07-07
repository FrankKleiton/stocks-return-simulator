'use client';

import { useEffect, useState } from 'react';
import { Button, Card, NumberInput, Select, SimpleGrid, Stack, TextInput, Title } from '@mantine/core';
import type { DividendMode, PortfolioItem, SimulationInput, SimulationResult } from '@/lib/types';

const dividendModeOptions = [
  { value: 'ignore', label: 'Ignore dividends' },
  { value: 'cash', label: 'Receive as cash' },
  { value: 'reinvest', label: 'Automatically reinvest' }
];

const simulatorStorageKey = 'historicalSimulator';

const defaultSimulatorValues = {
  startDate: '2014-01-01',
  endDate: new Date().toISOString().slice(0, 10),
  initialInvestment: 10000,
  monthlyContribution: 500,
  dividendMode: 'reinvest' as DividendMode
};

function simulationInputFromForm(form: FormData, holdings: PortfolioItem[]): SimulationInput {
  return {
    holdings,
    startDate: String(form.get('startDate')),
    endDate: String(form.get('endDate')),
    initialInvestment: Number(form.get('initialInvestment')),
    monthlyContribution: Number(form.get('monthlyContribution')),
    dividendMode: String(form.get('dividendMode')) as DividendMode
  };
}

export default function SimulationForm({ holdings, onResult }: { holdings: PortfolioItem[]; onResult: (r: SimulationResult) => void }) {
  const [values, setValues] = useState(defaultSimulatorValues);

  useEffect(() => {
    const saved = localStorage.getItem(simulatorStorageKey);
    if (saved) setValues(current => ({ ...current, ...JSON.parse(saved) }));
  }, []);

  async function submit(form: FormData) {
    const input = simulationInputFromForm(form, holdings);
    localStorage.setItem(simulatorStorageKey, JSON.stringify({
      startDate: input.startDate,
      endDate: input.endDate,
      initialInvestment: input.initialInvestment,
      monthlyContribution: input.monthlyContribution,
      dividendMode: input.dividendMode
    }));
    const res = await fetch('/api/simulate', { method: 'POST', body: JSON.stringify(input) });
    if (!res.ok) throw new Error('Simulation failed');
    onResult(await res.json());
  }

  return <Card withBorder shadow="md" radius="lg" p={{ base: 'sm', sm: 'md' }}>
    <Stack gap="md">
      <Title order={2} fz={{ base: 'lg', sm: 'xl' }}>Historical simulator</Title>
      <form action={submit}>
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 1 }} spacing="sm">
            <TextInput label="Start date" name="startDate" type="date" value={values.startDate} onChange={event => {
              const startDate = event.currentTarget.value;
              setValues(current => ({ ...current, startDate }));
            }}/>
            <TextInput label="End date" name="endDate" type="date" value={values.endDate} onChange={event => {
              const endDate = event.currentTarget.value;
              setValues(current => ({ ...current, endDate }));
            }}/>
            <NumberInput label="Initial investment" name="initialInvestment" value={values.initialInvestment} onChange={value => setValues(current => ({ ...current, initialInvestment: Number(value) || 0 }))} min={0}/>
            <NumberInput label="Monthly contribution" name="monthlyContribution" value={values.monthlyContribution} onChange={value => setValues(current => ({ ...current, monthlyContribution: Number(value) || 0 }))} min={0}/>
          </SimpleGrid>
          <Select label="Dividends" name="dividendMode" value={values.dividendMode} onChange={value => setValues(current => ({ ...current, dividendMode: (value ?? 'reinvest') as DividendMode }))} data={dividendModeOptions}/>
          <Button type="submit" fullWidth disabled={!holdings.length}>Run simulation</Button>
        </Stack>
      </form>
    </Stack>
  </Card>;
}
