'use client';
import { Card, SimpleGrid, Title, useComputedColorScheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import type { ChartOptions, Scale, TooltipItem } from 'chart.js';
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import type { Currency, SimulationResult } from '@/lib/types';
import { brDate, money, moneyCompact, monthYear } from '@/lib/metrics';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

const palette = ['#22d3ee', '#8b5cf6', '#10b981', '#f59e0b', '#f472b6', '#84cc16', '#fb7185', '#38bdf8'];

/** Chart.js paints onto a canvas, so the theme colours must be passed in rather than inherited from CSS. */
function chartTheme(dark: boolean) {
  return { text: dark ? '#cbd5e1' : '#334155', muted: dark ? '#94a3b8' : '#64748b', grid: dark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)', surface: dark ? '#07111f' : '#ffffff' };
}

function cartesianOptions(theme: ReturnType<typeof chartTheme>, currency: Currency, compact: boolean, xLabel: (label: string) => string, titleLabel: (label: string) => string): ChartOptions<'line' | 'bar'> {
  const amount = (item: TooltipItem<'line' | 'bar'>) => `${item.dataset.label}: ${money(Number(item.raw), currency)}`;
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: theme.text, boxWidth: 12, boxHeight: 12 } },
      tooltip: { callbacks: { title: items => titleLabel(String(items[0]?.label ?? '')), label: amount } }
    },
    scales: {
      x: { ticks: { color: theme.muted, maxTicksLimit: compact ? 4 : 8, maxRotation: 0, callback(this: Scale, value) { return xLabel(this.getLabelForValue(Number(value))); } }, grid: { color: theme.grid } },
      y: { ticks: { color: theme.muted, maxTicksLimit: compact ? 5 : 8, callback: value => moneyCompact(Number(value), currency) }, grid: { color: theme.grid } }
    }
  };
}

export default function PortfolioCharts({ result }: { result: SimulationResult }) {
  const dark = useComputedColorScheme('dark') === 'dark';
  const theme = chartTheme(dark);
  const currency = result.currency;
  // Phones get fewer axis ticks, shorter canvases and the legend under the doughnut instead of beside it.
  const compact = useMediaQuery('(max-width: 48em)') ?? false;
  const height = compact ? 240 : 280;

  const valueData = {
    labels: result.series.map(p => p.date),
    datasets: [
      { label: 'Valor da carteira', data: result.series.map(p => p.value), borderColor: '#22d3ee', backgroundColor: 'rgba(34, 211, 238, 0.18)', fill: true, tension: 0.35, borderWidth: 1.5, pointRadius: 0 },
      { label: 'Aportes', data: result.series.map(p => p.contributions), borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.12)', fill: true, tension: 0.35, borderWidth: 1.5, pointRadius: 0 }
    ]
  };
  const dividendData = {
    labels: result.dividendsByYear.map(d => d.year),
    datasets: [{ label: 'Renda de dividendos', data: result.dividendsByYear.map(d => d.amount), backgroundColor: '#10b981', borderRadius: 4 }]
  };
  const totalValue = result.allocation.reduce((sum, a) => sum + a.value, 0);
  const allocationData = {
    labels: result.allocation.map(a => a.ticker),
    datasets: [{ data: result.allocation.map(a => a.value), backgroundColor: result.allocation.map((_, i) => palette[i % palette.length]), borderColor: theme.surface, borderWidth: 2 }]
  };
  const allocationOptions: ChartOptions<'doughnut'> = {
    responsive: true, maintainAspectRatio: false, cutout: '55%',
    plugins: {
      legend: { position: compact ? 'bottom' : 'right', labels: { color: theme.text, boxWidth: 12, boxHeight: 12 } },
      tooltip: { callbacks: { label: item => `${item.label}: ${money(Number(item.raw), currency)} (${totalValue ? ((Number(item.raw) / totalValue) * 100).toFixed(1) : '0.0'}%)` } }
    }
  };

  return <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
    <Card withBorder shadow="md" radius="lg" p={{ base: 'sm', sm: 'md' }} style={{ gridColumn: '1 / -1' }}>
      <Title order={3} fz="md" mb="sm">Valor da carteira ao longo do tempo</Title>
      <div style={{ height: compact ? 260 : 320 }}><Line data={valueData} options={cartesianOptions(theme, currency, compact, monthYear, brDate) as ChartOptions<'line'>}/></div>
    </Card>
    <Card withBorder shadow="md" radius="lg" p={{ base: 'sm', sm: 'md' }}>
      <Title order={3} fz="md" mb="sm">Renda de dividendos por ano</Title>
      <div style={{ height }}><Bar data={dividendData} options={cartesianOptions(theme, currency, compact, label => label, label => label) as ChartOptions<'bar'>}/></div>
    </Card>
    <Card withBorder shadow="md" radius="lg" p={{ base: 'sm', sm: 'md' }}>
      <Title order={3} fz="md" mb="sm">Alocação no fim do período</Title>
      <div style={{ height }}><Doughnut data={allocationData} options={allocationOptions}/></div>
    </Card>
  </SimpleGrid>;
}
