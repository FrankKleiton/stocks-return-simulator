'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Card, NumberInput, Select, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
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

type SimulatorValues = typeof defaultSimulatorValues;

const moneyInputProps = { prefix: 'R$ ', thousandSeparator: '.', decimalSeparator: ',', decimalScale: 2, min: 0, hideControls: true } as const;

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
    const parsed = JSON.parse(saved) as Partial<SimulatorValues>;
    setValues(current => ({
      ...current,
      ...parsed,
      startDate: clampToToday(parsed.startDate ?? current.startDate),
      endDate: clampToToday(parsed.endDate ?? current.endDate)
    }));
  }, []);

  const update = <K extends keyof SimulatorValues>(key: K, value: SimulatorValues[K]) => setValues(current => ({ ...current, [key]: value }));
  const invalidRange = values.startDate > values.endDate;

  // A plain submit handler, not a React 19 form `action`: actions run inside a
  // transition, so state set there only commits once the request finishes and
  // the loading state would never be shown. The inputs are controlled, so the
  // request is built from state rather than from the (formatted) form fields.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running || invalidRange) return;
    const input: SimulationInput = { holdings, ...values };
    localStorage.setItem(simulatorStorageKey, JSON.stringify(values));
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
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
            <TextInput label="Data inicial" type="date" value={values.startDate} max={today()} required error={invalidRange ? 'Depois da data final' : undefined}
              onChange={event => update('startDate', clampToToday(event.currentTarget.value))}/>
            <TextInput label="Data final" type="date" value={values.endDate} max={today()} required
              onChange={event => update('endDate', clampToToday(event.currentTarget.value))}/>
            <NumberInput label="Investimento inicial" value={values.initialInvestment} onChange={value => update('initialInvestment', Number(value) || 0)} {...moneyInputProps}/>
            <NumberInput label="Aporte mensal" value={values.monthlyContribution} onChange={value => update('monthlyContribution', Number(value) || 0)} {...moneyInputProps}/>
          </SimpleGrid>
          <Select label="Dividendos" value={values.dividendMode} onChange={value => update('dividendMode', (value ?? 'reinvest') as DividendMode)} data={dividendModeOptions} allowDeselect={false}/>
          {error && <Alert color="red" variant="light" icon={<AlertTriangle size={18} />} title="A simulação falhou">{error}</Alert>}
          <Button type="submit" fullWidth loading={running} disabled={!holdings.length || invalidRange}>{running ? 'Rodando simulação…' : 'Rodar simulação'}</Button>
          {!holdings.length && <Text size="xs" c="dimmed" ta="center">Adicione pelo menos um ativo à carteira para rodar a simulação.</Text>}
        </Stack>
      </form>
    </Stack>
  </Card>;
}
