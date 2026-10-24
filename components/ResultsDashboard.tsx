'use client';

import { Box, Card, Loader, LoadingOverlay, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import type { SimulationResult } from '@/lib/types';
import { brl, pct } from '@/lib/metrics';
import PortfolioCharts from './Charts/PortfolioCharts';
import ResultTables from './Tables/ResultTables';

interface ResultCard { label: string; value: string; hint?: string; tone?: 'positive' | 'negative' }

const signed = (value: number): ResultCard['tone'] => (value >= 0 ? 'positive' : 'negative');

function performanceCards(result: SimulationResult): ResultCard[] {
  return [
    { label: 'Valor investido', value: brl(result.totalInvested), hint: 'Investimento inicial + aportes mensais' },
    { label: 'Valor final', value: brl(result.finalValue), hint: 'Posições + saldo em caixa no fim do período' },
    { label: 'Retorno total', value: pct(result.totalReturn), tone: signed(result.totalReturn), hint: 'Sobre o valor investido' },
    { label: 'Retorno anual (TIR)', value: pct(result.moneyWeightedAnnualizedReturn), tone: signed(result.moneyWeightedAnnualizedReturn), hint: 'Money-weighted: considera as datas dos aportes' },
    { label: 'Retorno anual (TWR)', value: pct(result.timeWeightedAnnualizedReturn), tone: signed(result.timeWeightedAnnualizedReturn), hint: 'Time-weighted: independe do momento dos aportes' },
    { label: 'Melhor / pior ativo', value: `${result.best?.ticker ?? '-'} / ${result.worst?.ticker ?? '-'}`, hint: result.best && result.worst ? `${pct(result.best.returnPct)} / ${pct(result.worst.returnPct)}` : undefined }
  ];
}

function dividendCards(result: SimulationResult): ResultCard[] {
  return [
    { label: 'Dividendos recebidos', value: brl(result.totalDividends), hint: 'Total no período' },
    { label: 'Dividendos reinvestidos', value: brl(result.totalDividendsReinvested) },
    { label: 'Renda anual média', value: brl(result.annualDividendIncome), hint: 'Dividendos ÷ anos simulados' },
    { label: `Renda em ${result.lastFullYear}`, value: brl(result.lastFullYearDividendIncome), hint: 'Último ano completo' },
    { label: 'Saldo em caixa', value: brl(result.cashBalance), hint: 'Dividendos não reinvestidos' }
  ];
}

const toneColor: Record<NonNullable<ResultCard['tone']>, string> = { positive: 'matrix.4', negative: 'red.5' };

function ResultMetric({ label, value, hint, tone }: ResultCard) {
  return <Card withBorder shadow="md" radius="lg" p="md">
    <Text size="xs" tt="uppercase" c="dimmed" fw={700}>{label}</Text>
    <Text mt={4} fz={{ base: 22, sm: 26 }} fw={800} c={tone ? toneColor[tone] : undefined} style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</Text>
    {hint && <Text size="xs" c="dimmed" mt={2}>{hint}</Text>}
  </Card>;
}

function MetricSection({ title, cards, cols }: { title: string; cards: ResultCard[]; cols: Record<string, number> }) {
  return <Stack gap="xs">
    <Title order={3} fz="sm" tt="uppercase" c="dimmed" fw={800} style={{ letterSpacing: '0.08em' }}>{title}</Title>
    <SimpleGrid cols={cols} spacing="md">
      {cards.map(card => <ResultMetric key={card.label} {...card} />)}
    </SimpleGrid>
  </Stack>;
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
    <Stack gap="lg" aria-busy={loading}>
      <MetricSection title="Desempenho" cards={performanceCards(result)} cols={{ base: 1, xs: 2, md: 3 }} />
      <MetricSection title="Dividendos" cards={dividendCards(result)} cols={{ base: 1, xs: 2, md: 3, lg: 5 }} />
      <PortfolioCharts result={result}/>
      <ResultTables result={result}/>
    </Stack>
  </Box>;
}
