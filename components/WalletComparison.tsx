'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Badge, Button, Card, Group, MultiSelect, NumberInput, ScrollArea, Select, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import type { ChartOptions } from 'chart.js';
import { CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { DividendMode, PortfolioItem, Recommendation, SimulationInput, SimulationResult } from '@/lib/types';
import { brl, pct } from '@/lib/metrics';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

type WalletStrategy = 'quality' | 'magicFormula' | 'valueIncome' | 'dividends' | 'cheapPvp' | 'roe';
type WalletResult = { strategy: WalletStrategy; name: string; holdings: PortfolioItem[]; result: SimulationResult };

const colors = ['#22d3ee', '#8b5cf6', '#10b981', '#f59e0b', '#f472b6', '#84cc16'];
const strategyLabels: Record<WalletStrategy, string> = {
  quality: 'Quality score',
  magicFormula: 'Magic Formula',
  valueIncome: 'Value + income filter',
  dividends: 'Dividend yield',
  cheapPvp: 'Lowest P/VP',
  roe: 'Highest avg ROE'
};

const strategyOptions = Object.entries(strategyLabels).map(([value, label]) => ({ value, label }));
const dividendModeOptions = [
  { value: 'ignore', label: 'Ignore dividends' },
  { value: 'cash', label: 'Receive as cash' },
  { value: 'reinvest', label: 'Automatically reinvest' }
];

const clampScore = (value: number) => Math.max(0, Math.min(100, value));
const pvpBelowAverageScore = (stock: Recommendation) =>
  stock.pVp > 0 && stock.averagePVp > 0 && stock.pVp < stock.averagePVp
    ? clampScore(((stock.averagePVp - stock.pVp) / stock.averagePVp) * 100)
    : 0;
const valueIncomeScore = (stock: Recommendation) =>
  clampScore((stock.earningsYield / 15) * 100) * 0.22 +
  clampScore((stock.averageRoe / 25) * 100) * 0.44 +
  clampScore((stock.averageDividendYield / 10) * 100) * 0.22 +
  pvpBelowAverageScore(stock) * 0.12;

function sortedByStrategy(data: Recommendation[], strategy: WalletStrategy) {
  return [...data].sort((a, b) => {
    if (strategy === 'quality') return b.qualityScore - a.qualityScore;
    if (strategy === 'magicFormula') return b.magicFormulaScore - a.magicFormulaScore;
    if (strategy === 'valueIncome') return valueIncomeScore(b) - valueIncomeScore(a);
    if (strategy === 'dividends') return b.averageDividendYield - a.averageDividendYield;
    if (strategy === 'cheapPvp') return (a.pVp || Number.POSITIVE_INFINITY) - (b.pVp || Number.POSITIVE_INFINITY);
    return b.averageRoe - a.averageRoe;
  });
}

function equalWeightWallet(stocks: Recommendation[]): PortfolioItem[] {
  const allocation = stocks.length ? 100 / stocks.length : 0;
  return stocks.map(stock => ({ ticker: stock.ticker, name: stock.companyName, allocation }));
}

export default function WalletComparison({ data, loading }: { data: Recommendation[]; loading: boolean }) {
  const [strategies, setStrategies] = useState<string[]>(['quality', 'magicFormula', 'valueIncome']);
  const [sectorFilter, setSectorFilter] = useState('all');
  const [topCount, setTopCount] = useState(15);
  const [startDate, setStartDate] = useState('2014-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [initialInvestment, setInitialInvestment] = useState(10000);
  const [monthlyContribution, setMonthlyContribution] = useState(500);
  const [dividendMode, setDividendMode] = useState<DividendMode>('reinvest');
  const [running, setRunning] = useState(false);
  const [walletResults, setWalletResults] = useState<WalletResult[]>([]);

  const sectorOptions = useMemo(() => [
    { value: 'all', label: 'All sectors' },
    ...[...new Set(data.map(stock => stock.sector || 'N/D'))]
      .sort((a, b) => a.localeCompare(b))
      .map(sector => ({ value: sector, label: sector }))
  ], [data]);

  const filteredData = useMemo(() => sectorFilter === 'all' ? data : data.filter(stock => (stock.sector || 'N/D') === sectorFilter), [data, sectorFilter]);
  const previewWallets = useMemo(() => strategies.map(strategy => ({
    strategy: strategy as WalletStrategy,
    name: strategyLabels[strategy as WalletStrategy],
    holdings: equalWeightWallet(sortedByStrategy(filteredData, strategy as WalletStrategy).slice(0, topCount))
  })).filter(wallet => wallet.holdings.length), [filteredData, strategies, topCount]);

  async function compare(event: FormEvent) {
    event.preventDefault();
    setRunning(true);
    try {
      const results = await Promise.all(previewWallets.map(async wallet => {
        const input: SimulationInput = { holdings: wallet.holdings, startDate, endDate, initialInvestment, monthlyContribution, dividendMode };
        const response = await fetch('/api/simulate', { method: 'POST', body: JSON.stringify(input) });
        if (!response.ok) throw new Error(`Simulation failed for ${wallet.name}`);
        return { ...wallet, result: await response.json() as SimulationResult };
      }));
      setWalletResults(results);
    } finally {
      setRunning(false);
    }
  }

  const chartLabels = [...new Set(walletResults.flatMap(wallet => wallet.result.series.map(point => point.date)))].sort();
  const chartData = {
    labels: chartLabels,
    datasets: walletResults.map((wallet, index) => {
      let pointIndex = 0;
      return {
        label: wallet.name,
        data: chartLabels.map(date => {
          while (pointIndex + 1 < wallet.result.series.length && wallet.result.series[pointIndex + 1].date <= date) pointIndex++;
          return wallet.result.series[pointIndex]?.value ?? null;
        }),
        borderColor: colors[index % colors.length],
        backgroundColor: `${colors[index % colors.length]}33`,
        fill: false,
        tension: 0.25,
        borderWidth: 1.8,
        pointRadius: 0
      };
    })
  };

  return <Card withBorder shadow="md" radius="xl" p={{ base: 'sm', sm: 'lg' }}>
    <Stack gap="md">
      <div>
        <Title order={2} fz={{ base: 'lg', sm: 'xl' }}>Compare generated wallets</Title>
        <Text size="sm" c="dimmed">Build equal-weight wallets from different sorting filters and compare their historical performance over time.</Text>
      </div>

      <form onSubmit={compare}>
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }} spacing="sm">
            <MultiSelect label="Wallet sorting filters" data={strategyOptions} value={strategies} onChange={setStrategies} disabled={loading}/>
            <Select label="Sector" searchable value={sectorFilter} onChange={(value) => setSectorFilter(value ?? 'all')} data={sectorOptions} disabled={loading}/>
            <NumberInput label="Stocks per wallet" min={2} max={20} value={topCount} onChange={value => setTopCount(Number(value) || 2)}/>
            <Select label="Dividends" value={dividendMode} onChange={value => setDividendMode((value ?? 'reinvest') as DividendMode)} data={dividendModeOptions}/>
            <TextInput label="Start date" type="date" value={startDate} onChange={event => setStartDate(event.currentTarget.value)}/>
            <TextInput label="End date" type="date" value={endDate} onChange={event => setEndDate(event.currentTarget.value)}/>
            <NumberInput label="Initial investment" min={0} value={initialInvestment} onChange={value => setInitialInvestment(Number(value) || 0)}/>
            <NumberInput label="Monthly contribution" min={0} value={monthlyContribution} onChange={value => setMonthlyContribution(Number(value) || 0)}/>
          </SimpleGrid>
          <Button type="submit" loading={running} disabled={loading || !previewWallets.length}>Compare wallets</Button>
        </Stack>
      </form>

      {!!previewWallets.length && <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
        {previewWallets.map(wallet => <Card key={wallet.strategy} withBorder radius="lg" p="sm">
          <Group gap="xs" mb={6}><Badge variant="light" color="cyber">{wallet.name}</Badge><Text size="xs" c="dimmed">{wallet.holdings.length} stocks</Text></Group>
          <Text size="xs" c="dimmed" lineClamp={3}>{wallet.holdings.map(holding => holding.ticker).join(' • ')}</Text>
        </Card>)}
      </SimpleGrid>}

      {!!walletResults.length && <>
        <Card withBorder radius="lg" p="md">
          <Title order={3} fz="md" mb="sm">Wallet value over time</Title>
          <div style={{ height: 340 }}><Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#cbd5e1' } }, tooltip: { mode: 'index', intersect: false } }, scales: { x: { ticks: { color: '#94a3b8', maxTicksLimit: 8 }, grid: { color: 'rgba(148,163,184,0.12)' } }, y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.12)' } } } } as ChartOptions<'line'>}/></div>
        </Card>
        <ScrollArea type="auto">
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
            {walletResults.map((wallet, index) => <Card key={wallet.strategy} withBorder radius="lg" p="md">
              <Stack gap={6}>
                <Group gap="xs"><Badge style={{ backgroundColor: colors[index % colors.length] }}>{wallet.name}</Badge><Text size="xs" c="dimmed">{wallet.holdings.length} stocks</Text></Group>
                <Text size="sm" fw={800}>{brl(wallet.result.finalValue)}</Text>
                <Text size="xs" c="dimmed">Total return: {pct(wallet.result.totalReturn)} • TWR: {pct(wallet.result.timeWeightedAnnualizedReturn)}</Text>
                <Text size="xs" c="dimmed">Best / worst: {wallet.result.best?.ticker ?? '-'} / {wallet.result.worst?.ticker ?? '-'}</Text>
                <Text size="xs" c="dimmed">{wallet.holdings.map(holding => holding.ticker).join(' • ')}</Text>
              </Stack>
            </Card>)}
          </SimpleGrid>
        </ScrollArea>
      </>}
    </Stack>
  </Card>;
}
