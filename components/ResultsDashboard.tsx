'use client';
import { Card, SimpleGrid, Stack, Text } from '@mantine/core';
import type { SimulationResult } from '@/lib/types';
import { brl, pct } from '@/lib/metrics';
import PortfolioCharts from './Charts/PortfolioCharts';
import ResultTables from './Tables/ResultTables';

export default function ResultsDashboard({ result }: { result?: SimulationResult }) {
  if (!result) return null;
  const cards = [['Final value', brl(result.finalValue)], ['Total return', pct(result.totalReturn)], ['Annualized return', pct(result.cagr)], ['Dividends received', brl(result.totalDividends)], ['Dividends reinvested', brl(result.totalDividendsReinvested)], ['Annual dividend income', brl(result.annualDividendIncome)], ['Cash balance', brl(result.cashBalance)], ['Best / worst', `${result.best?.ticker ?? '-'} / ${result.worst?.ticker ?? '-'}`]];
  return <Stack gap="md"><SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">{cards.map(([k,v]) => <Card withBorder shadow="md" radius="lg" p="md" key={k}><Text size="xs" tt="uppercase" c="dimmed" fw={700}>{k}</Text><Text mt={4} fz={{ base: 22, sm: 26 }} fw={800}>{v}</Text></Card>)}</SimpleGrid><PortfolioCharts result={result}/><ResultTables result={result}/></Stack>;
}
