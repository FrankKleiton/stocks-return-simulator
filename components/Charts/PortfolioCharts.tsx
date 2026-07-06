'use client';
import { Card, SimpleGrid, Title } from '@mantine/core';
import type { ChartOptions } from 'chart.js';
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import type { SimulationResult } from '@/lib/types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

const colors = ['#22d3ee', '#8b5cf6', '#10b981', '#f59e0b', '#f472b6', '#84cc16', '#fb7185'];
const commonOptions: ChartOptions<'line' | 'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#cbd5e1' } }, tooltip: { mode: 'index', intersect: false } },
  scales: {
    x: { ticks: { color: '#94a3b8', maxTicksLimit: 8 }, grid: { color: 'rgba(148,163,184,0.12)' } },
    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.12)' } }
  }
};

export default function PortfolioCharts({ result }: { result: SimulationResult }) {
  const valueData = {
    labels: result.series.map(p => p.date),
    datasets: [
      { label: 'Portfolio value', data: result.series.map(p => p.value), borderColor: '#22d3ee', backgroundColor: 'rgba(34, 211, 238, 0.18)', fill: true, tension: 0.35, borderWidth: 1.5, pointRadius: 0 },
      { label: 'Contributions', data: result.series.map(p => p.contributions), borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.12)', fill: true, tension: 0.35, borderWidth: 1.5, pointRadius: 0 }
    ]
  };
  const dividendData = {
    labels: result.dividendsByYear.map(d => d.year),
    datasets: [{ label: 'Dividend income', data: result.dividendsByYear.map(d => d.amount), backgroundColor: '#10b981' }]
  };
  const allocationData = {
    labels: result.allocation.map(a => a.ticker),
    datasets: [{ data: result.allocation.map(a => a.value), backgroundColor: result.allocation.map((_, i) => colors[i % colors.length]), borderColor: '#22d3ee', borderWidth: 1.5 }]
  };

  return <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
    <Card withBorder shadow="md" radius="lg" p="md"><Title order={3} fz="md" mb="sm">Portfolio value over time</Title><div style={{ height: 280 }}><Line data={valueData} options={commonOptions as ChartOptions<'line'>}/></div></Card>
    <Card withBorder shadow="md" radius="lg" p="md"><Title order={3} fz="md" mb="sm">Dividend income by year</Title><div style={{ height: 280 }}><Bar data={dividendData} options={commonOptions as ChartOptions<'bar'>}/></div></Card>
    <Card withBorder shadow="md" radius="lg" p="md"><Title order={3} fz="md" mb="sm">Portfolio allocation</Title><div style={{ height: 280 }}><Pie data={allocationData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#cbd5e1' } } } }}/></div></Card>
  </SimpleGrid>;
}
