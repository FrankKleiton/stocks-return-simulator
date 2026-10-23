'use client';

import { Box, Card, Loader, LoadingOverlay, SimpleGrid, Stack, Text } from '@mantine/core';
import type { SimulationResult } from '@/lib/types';
import { brl, pct } from '@/lib/metrics';
import PortfolioCharts from './Charts/PortfolioCharts';
import ResultTables from './Tables/ResultTables';

type ResultCard = [label: string, value: string];

function resultCards(result: SimulationResult): ResultCard[] {
  return [
    ['Valor investido', brl(result.totalInvested)],
    ['Valor final', brl(result.finalValue)],
    ['Retorno total', pct(result.totalReturn)],
    ['Retorno money-weighted (TIR)', pct(result.moneyWeightedAnnualizedReturn)],
    ['Retorno time-weighted (TWR)', pct(result.timeWeightedAnnualizedReturn)],
    ['Dividendos recebidos', brl(result.totalDividends)],
    ['Dividendos reinvestidos', brl(result.totalDividendsReinvested)],
    ['Renda anual de dividendos média', brl(result.annualDividendIncome)],
    [`Renda anual de dividendos (${result.lastFullYear})`, brl(result.lastFullYearDividendIncome)],
    ['Saldo em caixa', brl(result.cashBalance)],
    ['Melhor / pior', `${result.best?.ticker ?? '-'} / ${result.worst?.ticker ?? '-'}`]
  ];
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return <Card withBorder shadow="md" radius="lg" p="md">
    <Text size="xs" tt="uppercase" c="dimmed" fw={700}>{label}</Text>
    <Text mt={4} fz={{ base: 22, sm: 26 }} fw={800}>{value}</Text>
  </Card>;
}

const loadingTitle = 'Rodando a simulação…';
const loadingHint = 'Buscando preços e proventos no Investidor10. A primeira simulação de uma ação pode levar alguns segundos.';

function LoadingPlaceholder() {
  return <Card withBorder shadow="md" radius="lg" p="xl" role="status" aria-live="polite">
    <Stack align="center" gap="sm" py="lg">
      <Loader size="lg" />
      <Text fw={800} fz="lg">{loadingTitle}</Text>
      <Text size="sm" c="dimmed" ta="center" maw={420}>{loadingHint}</Text>
    </Stack>
  </Card>;
}

export default function ResultsDashboard({ result, loading = false }: { result?: SimulationResult; loading?: boolean }) {
  if (!result) return loading ? <LoadingPlaceholder /> : null;

  // Re-running keeps the previous results visible but dimmed, so the numbers do not jump around mid-request.
  return <Box pos="relative">
    <LoadingOverlay visible={loading} zIndex={10} overlayProps={{ radius: 'lg', blur: 2 }}
      loaderProps={{ children: <Stack align="center" gap="xs" role="status" aria-live="polite"><Loader size="lg" /><Text fw={700}>{loadingTitle}</Text></Stack> }} />
    <Stack gap="md" aria-busy={loading}>
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
        {resultCards(result).map(([label, value]) => <ResultMetric key={label} label={label} value={value} />)}
      </SimpleGrid>
      <PortfolioCharts result={result}/>
      <ResultTables result={result}/>
    </Stack>
  </Box>;
}
