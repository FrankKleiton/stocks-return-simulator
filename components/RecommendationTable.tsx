'use client';
import { useMemo, useState } from 'react';
import { Badge, Button, Card, Group, ScrollArea, Select, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import type { HistoricalFcfValuation } from '@/lib/fcfValuation';
import type { Recommendation } from '@/lib/types';
import { brl, pct } from '@/lib/metrics';

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div>
    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{label}</Text>
    <Text size="sm" fw={700}>{value}</Text>
  </div>;
}

export default function RecommendationTable({ data, onAdd, loading }: { data: Recommendation[]; loading: boolean; onAdd: (r: Recommendation) => void }) {
  const [sortBy, setSortBy] = useState<'quality' | 'valuation' | 'magic'>('quality');
  const [valuationByTicker, setValuationByTicker] = useState<Record<string, HistoricalFcfValuation>>({});
  const [loadingValuation, setLoadingValuation] = useState<string>();
  const sortedData = useMemo(() => [...data].sort((a, b) => sortBy === 'valuation' ? b.valuationScore - a.valuationScore : sortBy === 'magic' ? b.magicFormulaScore - a.magicFormulaScore : b.qualityScore - a.qualityScore), [data, sortBy]);

  const analyzeFcf = async (ticker: string) => {
    setLoadingValuation(ticker);
    try {
      const valuation = await fetch(`/api/fcf-valuation?ticker=${encodeURIComponent(ticker)}`).then(r => r.json());
      setValuationByTicker(current => ({ ...current, [ticker]: valuation }));
    } finally {
      setLoadingValuation(undefined);
    }
  };

  return <Card withBorder shadow="md" radius="lg" p={{ base: 'sm', sm: 'md' }}>
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" gap="sm">
        <div>
          <Title order={2} fz={{ base: 'lg', sm: 'xl' }}>Quality recommendations</Title>
          <Text size="sm" c="dimmed">A Greenblatt-inspired ranking using ROIC + earnings yield, adjusted for Brazilian valuation, dividends and stability.</Text>
        </div>
        <Group gap="xs">
          {loading && <Text size="sm" c="cyber.3">Analyzing…</Text>}
          <Select w={{ base: 170, sm: 210 }} value={sortBy} onChange={(v) => setSortBy((v ?? 'quality') as 'quality' | 'valuation' | 'magic')} data={[{ value: 'quality', label: 'Sort: Quality' }, { value: 'magic', label: 'Sort: Magic Formula' }, { value: 'valuation', label: 'Sort: Valuation' }]}/>
        </Group>
      </Group>

      <ScrollArea h={{ base: 560, md: 720 }} offsetScrollbars type="auto">
        <Stack gap="sm" pr="sm">
        {sortedData.map((stock, index) => <Card key={stock.ticker} withBorder radius="lg" p="md">
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Group gap="sm" align="flex-start">
                <Badge size="lg" color="dark" variant="filled">#{index + 1}</Badge>
                <div>
                  <Group gap="xs"><Title order={3} fz="lg">{stock.ticker}</Title><Badge color="cyber" variant="light">Q {stock.qualityScore}</Badge><Badge color="matrix" variant="light">MF {stock.magicFormulaScore}</Badge><Badge color="plasma" variant="light">V {stock.valuationScore}</Badge></Group>
                  <Text size="sm" c="dimmed" lineClamp={1}>{stock.companyName || 'Company name unavailable'}</Text>
                  <Text size="xs" c="dimmed">{stock.industry}</Text>
                </div>
              </Group>
              <Group gap="xs" wrap="nowrap">
                <Button size="xs" variant="light" loading={loadingValuation === stock.ticker} onClick={() => analyzeFcf(stock.ticker)}>Analyze FCF</Button>
                <Button size="xs" onClick={() => onAdd(stock)}>Add</Button>
              </Group>
            </Group>

            {valuationByTicker[stock.ticker] && <Card withBorder radius="md" p="sm" bg="dark.8">
              {valuationByTicker[stock.ticker].status === 'available' ? <Stack gap={4}>
                <Group gap="xs"><Badge color="matrix" variant="light">Historical FCF valuation</Badge><Text size="xs" c="dimmed">Latest {valuationByTicker[stock.ticker].selectedAnnualFcf.length} annual values</Text></Group>
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
                  <Metric label="Normalized FCF" value={brl(valuationByTicker[stock.ticker].normalizedFcf)} />
                  <Metric label="Conservative 10%" value={brl(valuationByTicker[stock.ticker].scenarios.conservative.companyValue)} />
                  <Metric label="Base 8%" value={brl(valuationByTicker[stock.ticker].scenarios.base.companyValue)} />
                  <Metric label="Optimistic 6%" value={brl(valuationByTicker[stock.ticker].scenarios.optimistic.companyValue)} />
                </SimpleGrid>
              </Stack> : <Text size="sm" c="dimmed">Historical FCF valuation unavailable for positive annual FCF data.</Text>}
            </Card>}

            <SimpleGrid cols={{ base: 2, sm: 3, md: 4, xl: 6 }} spacing="sm">
              <Metric label="Price" value={brl(stock.price)} />
              <Metric label="Earn. Yield" value={pct(stock.earningsYield)} />
              <Metric label="P/E" value={stock.pL > 0 ? stock.pL.toFixed(2) : '-'} />
              <Metric label="P/VP" value={stock.pVp.toFixed(2)} />
              <Metric label="Avg P/VP" value={stock.averagePVp.toFixed(2)} />
              <Metric label="ROE" value={pct(stock.roe)} />
              <Metric label="Avg ROE" value={pct(stock.averageRoe)} />
              <Metric label="ROIC" value={pct(stock.roic)} />
              <Metric label="Avg DY" value={pct(stock.averageDividendYield)} />
              <Metric label="Div years" value={stock.yearsPayingDividends} />
            </SimpleGrid>
          </Stack>
        </Card>)}
        {!loading && !sortedData.length && <Text c="dimmed" ta="center" py="xl">No recommendations available.</Text>}
        </Stack>
      </ScrollArea>
    </Stack>
  </Card>;
}
