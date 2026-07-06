'use client';

import { Card, SimpleGrid, Stack, Text } from '@mantine/core';
import type { SimulationResult } from '@/lib/types';
import { brl, pct } from '@/lib/metrics';
import PortfolioCharts from './Charts/PortfolioCharts';
import ResultTables from './Tables/ResultTables';

type ResultCard = [label: string, value: string];

function resultCards(result: SimulationResult): ResultCard[] {
  return [
    ['Final value', brl(result.finalValue)],
    ['Total return', pct(result.totalReturn)],
    ['Money-weighted return', pct(result.moneyWeightedAnnualizedReturn)],
    ['Time-weighted return', pct(result.timeWeightedAnnualizedReturn)],
    ['Dividends received', brl(result.totalDividends)],
    ['Dividends deployed', brl(result.totalDividendsReinvested)],
    ['Annual dividend income', brl(result.annualDividendIncome)],
    ['Cash balance', brl(result.cashBalance)],
    ['Best / worst', `${result.best?.ticker ?? '-'} / ${result.worst?.ticker ?? '-'}`]
  ];
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return <Card withBorder shadow="md" radius="lg" p="md">
    <Text size="xs" tt="uppercase" c="dimmed" fw={700}>{label}</Text>
    <Text mt={4} fz={{ base: 22, sm: 26 }} fw={800}>{value}</Text>
  </Card>;
}

export default function ResultsDashboard({ result }: { result?: SimulationResult }) {
  if (!result) return null;

  return <Stack gap="md">
    <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
      {resultCards(result).map(([label, value]) => <ResultMetric key={label} label={label} value={value} />)}
    </SimpleGrid>
    <PortfolioCharts result={result}/>
    <ResultTables result={result}/>
  </Stack>;
}
