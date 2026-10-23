'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Card, NumberInput, Select, SimpleGrid, Stack, TextInput, Title } from '@mantine/core';
import { AlertTriangle } from 'lucide-react';
import { errorMessage, fetchJson } from '@/lib/clientFetch';
import type { DividendMode, PortfolioItem, SimulationInput, SimulationResult } from '@/lib/types';

const dividendModeOptions = [
  { value: 'ignore', label: 'Ignorar dividendos' },
  { value: 'cash', label: 'Receber em dinheiro' },
  { value: 'reinvest', label: 'Reinvestir automaticamente' }
];

const simulatorStorageKey = 'historicalSimulator';

/** Local calendar date as YYYY-MM-DD; this is a back test, so no date may go past it. */
const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

const clampToToday = (date: string) => (date > today() ? today() : date);

const defaultSimulatorValues = {
  startDate: '2014-01-01',
  endDate: today(),
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

interface SimulationFormProps {
  holdings: PortfolioItem[];
  onResult: (result: SimulationResult) => void;
  /** Lets the page mirror the request state elsewhere (e.g. a loading state on the results). */
  onRunningChange?: (running: boolean) => void;
}

export default function SimulationForm({ holdings, onResult, onRunningChange }: SimulationFormProps) {
  const [values, setValues] = useState(defaultSimulatorValues);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const saved = localStorage.getItem(simulatorStorageKey);
    if (!saved) return;
    const parsed = JSON.parse(saved) as Partial<typeof defaultSimulatorValues>;
    setValues(current => ({
      ...current,
      ...parsed,
      startDate: clampToToday(parsed.startDate ?? current.startDate),
      endDate: clampToToday(parsed.endDate ?? current.endDate)
    }));
  }, []);

  // A plain submit handler, not a React 19 form `action`: actions run inside a
  // transition, so state set there only commits once the request finishes and
  // the loading state would never be shown.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running) return;
    const input = simulationInputFromForm(new FormData(event.currentTarget), holdings);
    localStorage.setItem(simulatorStorageKey, JSON.stringify({
      startDate: input.startDate,
      endDate: input.endDate,
      initialInvestment: input.initialInvestment,
      monthlyContribution: input.monthlyContribution,
      dividendMode: input.dividendMode
    }));
    setRunning(true);
    onRunningChange?.(true);
    setError(undefined);
    try {
      onResult(await fetchJson<SimulationResult>('/api/simulate', { method: 'POST', body: JSON.stringify(input) }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRunning(false);
      onRunningChange?.(false);
    }
  }

  return <Card withBorder shadow="md" radius="lg" p={{ base: 'sm', sm: 'md' }}>
    <Stack gap="md">
      <Title order={2} fz={{ base: 'lg', sm: 'xl' }}>Simulador histórico</Title>
      <form onSubmit={submit}>
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 1 }} spacing="sm">
            <TextInput label="Data inicial" name="startDate" type="date" value={values.startDate} max={today()} required onChange={event => {
              const startDate = clampToToday(event.currentTarget.value);
              setValues(current => ({ ...current, startDate }));
            }}/>
            <TextInput label="Data final" name="endDate" type="date" value={values.endDate} max={today()} required onChange={event => {
              const endDate = clampToToday(event.currentTarget.value);
              setValues(current => ({ ...current, endDate }));
            }}/>
            <NumberInput label="Investimento inicial" name="initialInvestment" value={values.initialInvestment} onChange={value => setValues(current => ({ ...current, initialInvestment: Number(value) || 0 }))} min={0}/>
            <NumberInput label="Aporte mensal" name="monthlyContribution" value={values.monthlyContribution} onChange={value => setValues(current => ({ ...current, monthlyContribution: Number(value) || 0 }))} min={0}/>
          </SimpleGrid>
          <Select label="Dividendos" name="dividendMode" value={values.dividendMode} onChange={value => setValues(current => ({ ...current, dividendMode: (value ?? 'reinvest') as DividendMode }))} data={dividendModeOptions}/>
          {error && <Alert color="red" variant="light" icon={<AlertTriangle size={18} />} title="A simulação falhou">{error}</Alert>}
          <Button type="submit" fullWidth loading={running} disabled={!holdings.length}>{running ? 'Rodando simulação…' : 'Rodar simulação'}</Button>
        </Stack>
      </form>
    </Stack>
  </Card>;
}
