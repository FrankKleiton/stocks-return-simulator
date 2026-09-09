'use client';
import { useMemo, useState } from 'react';
import { Badge, Button, Card, Group, ScrollArea, Select, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import type { HistoricalEarningsValuation, HistoricalFcfValuation } from '@/lib/fcfValuation';
import type { Recommendation } from '@/lib/types';
import { brl, pct } from '@/lib/metrics';
import { errorMessage, fetchJson } from '@/lib/clientFetch';

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div>
    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{label}</Text>
    <Text size="sm" fw={700}>{value}</Text>
  </div>;
}

const volatilityLabelsPt: Record<HistoricalFcfValuation['volatility'], string> = { low: 'baixa', medium: 'média', high: 'alta', very_high: 'muito alta' };
const volatilityLabel = (value: HistoricalFcfValuation['volatility']) => volatilityLabelsPt[value];

const warningMessagePt = (code: string, metricLabel: string) => {
  if (code === 'limited_history') return `O valuation usa menos de 10 valores anuais de ${metricLabel}`;
  return `O histórico de ${metricLabel} selecionado é volátil`;
};

const unavailableMessagePt = (reason: string | undefined, metricLabel: string) => {
  if (reason === 'could_not_fetch_free_cash_flow_data' || reason === 'could_not_fetch_earnings_data') return `não foi possível obter dados de ${metricLabel}`;
  if (reason === 'normalized_fcf_is_negative_or_zero' || reason === 'normalized_earnings_is_negative_or_zero') return `${metricLabel} normalizado é negativo ou zero`;
  return `dados de ${metricLabel} indisponíveis`;
};

export default function RecommendationTable({ data, onAdd, loading }: { data: Recommendation[]; loading: boolean; onAdd: (r: Recommendation) => void }) {
  const [sortBy, setSortBy] = useState<'none' | 'quality' | 'magicFormula' | 'valueIncome'>('none');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [valuationByTicker, setValuationByTicker] = useState<Record<string, HistoricalFcfValuation>>({});
  const [loadingValuation, setLoadingValuation] = useState<string>();
  const [earningsValuationByTicker, setEarningsValuationByTicker] = useState<Record<string, HistoricalEarningsValuation>>({});
  const [loadingEarningsValuation, setLoadingEarningsValuation] = useState<string>();
  const [valuationErrorByTicker, setValuationErrorByTicker] = useState<Record<string, string | undefined>>({});
  const sectorOptions = useMemo(() => [
    { value: 'all', label: 'Todos os setores' },
    ...[...new Set(data.map(stock => stock.sector || 'N/D'))]
      .sort((a, b) => a.localeCompare(b))
      .map(sector => ({ value: sector, label: sector }))
  ], [data]);
  const displayedData = useMemo(() => {
    const sectorData = sectorFilter === 'all' ? data : data.filter(stock => (stock.sector || 'N/D') === sectorFilter);
    if (sortBy === 'quality') return [...sectorData].sort((a, b) => b.qualityScore - a.qualityScore);
    if (sortBy === 'magicFormula') return [...sectorData].sort((a, b) => b.magicFormulaScore - a.magicFormulaScore);
    if (sortBy !== 'valueIncome') return sectorData;

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

    return [...sectorData].sort((a, b) => valueIncomeScore(b) - valueIncomeScore(a));
  }, [data, sectorFilter, sortBy]);

  const analyzeFcf = async (ticker: string) => {
    setLoadingValuation(ticker);
    try {
      const valuation = await fetchJson<HistoricalFcfValuation>(`/api/fcf-valuation?ticker=${encodeURIComponent(ticker)}`);
      setValuationByTicker(current => ({ ...current, [ticker]: valuation }));
      setValuationErrorByTicker(current => ({ ...current, [ticker]: undefined }));
    } catch (e) {
      setValuationErrorByTicker(current => ({ ...current, [ticker]: errorMessage(e) }));
    } finally {
      setLoadingValuation(undefined);
    }
  };

  const analyzeEarnings = async (ticker: string) => {
    setLoadingEarningsValuation(ticker);
    try {
      const valuation = await fetchJson<HistoricalEarningsValuation>(`/api/earnings-valuation?ticker=${encodeURIComponent(ticker)}`);
      setEarningsValuationByTicker(current => ({ ...current, [ticker]: valuation }));
      setValuationErrorByTicker(current => ({ ...current, [ticker]: undefined }));
    } catch (e) {
      setValuationErrorByTicker(current => ({ ...current, [ticker]: errorMessage(e) }));
    } finally {
      setLoadingEarningsValuation(undefined);
    }
  };

  return <Card className="recommendations-shell" withBorder shadow="md" radius="xl" p={{ base: 'sm', sm: 'lg' }}>
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" gap="sm">
        <div>
          <Title order={2} fz={{ base: 'lg', sm: 'xl' }}>Recomendações de qualidade</Title>
          <Text size="sm" c="dimmed">Um ranking inspirado em Greenblatt usando ROIC + earnings yield, com filtros opcionais de dividendos e P/L.</Text>
        </div>
        <Group gap="xs">
          {loading && <Text size="sm" c="cyber.3">Analisando…</Text>}
          <Select searchable w={{ base: 230, sm: 260 }} value={sectorFilter} onChange={(v) => setSectorFilter(v ?? 'all')} data={sectorOptions}/>
          <Select w={{ base: 230, sm: 360 }} value={sortBy} onChange={(v) => setSortBy((v ?? 'none') as 'none' | 'quality' | 'magicFormula' | 'valueIncome')} data={[{ value: 'none', label: 'Sem ordenação' }, { value: 'quality', label: 'Ordenar: Pontuação de qualidade' }, { value: 'magicFormula', label: 'Ordenar: Fórmula Mágica' }, { value: 'valueIncome', label: 'Ordenar: Earnings Yield + ROE médio + DY médio + P/VP abaixo da média' }]}/>
        </Group>
      </Group>

      <ScrollArea h={{ base: 560, md: 720 }} offsetScrollbars type="auto">
        <Stack gap="sm" pr="sm">
        {displayedData.map((stock, index) => <Card key={stock.ticker} withBorder radius="lg" p="md">
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start" gap="sm">
              <Group gap="sm" align="flex-start" wrap="nowrap">
                <Badge size="lg" color="dark" variant="filled">#{index + 1}</Badge>
                <div>
                  <Title order={3} fz="lg">{stock.ticker}</Title>
                  <Text size="sm" c="dimmed" lineClamp={1}>{stock.companyName || 'Nome da empresa indisponível'}</Text>
                  <Text size="xs" c="dimmed">{stock.industry}</Text>
                </div>
              </Group>
              <Group gap="xs">
                <Button size="xs" variant="light" loading={loadingValuation === stock.ticker} onClick={() => analyzeFcf(stock.ticker)}>Analisar FCL</Button>
                <Button size="xs" variant="light" loading={loadingEarningsValuation === stock.ticker} onClick={() => analyzeEarnings(stock.ticker)}>Analisar Lucros</Button>
                <Button size="xs" onClick={() => onAdd(stock)}>Adicionar</Button>
              </Group>
            </Group>

            {valuationErrorByTicker[stock.ticker] && <Text size="sm" c="red.5">Não foi possível analisar: {valuationErrorByTicker[stock.ticker]}</Text>}

            {valuationByTicker[stock.ticker] && <Card withBorder radius="md" p="sm">
              {valuationByTicker[stock.ticker].status === 'available' ? <Stack gap="xs">
                <Group gap="xs"><Badge color="matrix" variant="light">Valuation histórico de FCL</Badge><Badge color="yellow" variant="light">Volatilidade: {volatilityLabel(valuationByTicker[stock.ticker].volatility)}</Badge><Text size="xs" c="dimmed">Últimos {valuationByTicker[stock.ticker].selectedAnnualFcf.length} valores anuais</Text></Group>
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
                  <Metric label="FCL normalizado" value={brl(valuationByTicker[stock.ticker].normalizedFcf)} />
                  <Metric label="Conservador 10%" value={brl(valuationByTicker[stock.ticker].scenarios.conservative.companyValue)} />
                  <Metric label="Base 8%" value={brl(valuationByTicker[stock.ticker].scenarios.base.companyValue)} />
                  <Metric label="Otimista 6%" value={brl(valuationByTicker[stock.ticker].scenarios.optimistic.companyValue)} />
                </SimpleGrid>
                <Text size="xs" c="dimmed">Histórico de FCL selecionado: {valuationByTicker[stock.ticker].selectedAnnualFcf.map(point => `${point.year}: ${brl(point.fcf)}`).join(' • ')}</Text>
                {valuationByTicker[stock.ticker].warnings.length > 0 && <Stack gap={2}>{valuationByTicker[stock.ticker].warnings.map(warning => <Text key={warning.code} size="xs" c="yellow.4">⚠ {warningMessagePt(warning.code, 'FCL')}</Text>)}</Stack>}
                <Text size="xs" c="dimmed">Apenas para fins educacionais. Este valuation simplificado não é um DCF e pode ser pouco confiável quando as taxas de juros, os ciclos de commodities ou a volatilidade do FCL forem altos.</Text>
              </Stack> : <Stack gap={4}><Text size="sm" c="dimmed">Valuation histórico de FCL indisponível: {unavailableMessagePt(valuationByTicker[stock.ticker].reason, 'FCL')}.</Text><Text size="xs" c="dimmed">Apenas para fins educacionais. Este valuation simplificado não é um DCF e pode ser pouco confiável quando as taxas de juros, os ciclos de commodities ou a volatilidade do FCL forem altos.</Text></Stack>}
            </Card>}

            {earningsValuationByTicker[stock.ticker] && <Card withBorder radius="md" p="sm">
              {earningsValuationByTicker[stock.ticker].status === 'available' ? <Stack gap="xs">
                <Group gap="xs"><Badge color="matrix" variant="light">Valuation histórico de lucros</Badge><Badge color="yellow" variant="light">Volatilidade: {volatilityLabel(earningsValuationByTicker[stock.ticker].volatility)}</Badge><Text size="xs" c="dimmed">Últimos {earningsValuationByTicker[stock.ticker].selectedAnnualEarnings.length} valores anuais</Text></Group>
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
                  <Metric label="Lucro normalizado" value={brl(earningsValuationByTicker[stock.ticker].normalizedEarnings)} />
                  <Metric label="Conservador 10%" value={brl(earningsValuationByTicker[stock.ticker].scenarios.conservative.companyValue)} />
                  <Metric label="Base 8%" value={brl(earningsValuationByTicker[stock.ticker].scenarios.base.companyValue)} />
                  <Metric label="Otimista 6%" value={brl(earningsValuationByTicker[stock.ticker].scenarios.optimistic.companyValue)} />
                </SimpleGrid>
                <Text size="xs" c="dimmed">Histórico de lucros selecionado: {earningsValuationByTicker[stock.ticker].selectedAnnualEarnings.map(point => `${point.year}: ${brl(point.earnings)}`).join(' • ')}</Text>
                {earningsValuationByTicker[stock.ticker].warnings.length > 0 && <Stack gap={2}>{earningsValuationByTicker[stock.ticker].warnings.map(warning => <Text key={warning.code} size="xs" c="yellow.4">⚠ {warningMessagePt(warning.code, 'lucros')}</Text>)}</Stack>}
                <Text size="xs" c="dimmed">Apenas para fins educacionais. Este valuation simplificado não é um DCF e pode ser pouco confiável quando as taxas de juros, itens não recorrentes ou a volatilidade dos lucros forem altos.</Text>
              </Stack> : <Stack gap={4}><Text size="sm" c="dimmed">Valuation histórico de lucros indisponível: {unavailableMessagePt(earningsValuationByTicker[stock.ticker].reason, 'lucros')}.</Text><Text size="xs" c="dimmed">Apenas para fins educacionais. Este valuation simplificado não é um DCF e pode ser pouco confiável quando as taxas de juros, itens não recorrentes ou a volatilidade dos lucros forem altos.</Text></Stack>}
            </Card>}

            <SimpleGrid cols={{ base: 2, sm: 3, md: 4, xl: 6 }} spacing="sm">
              <Metric label="Preço" value={brl(stock.price)} />
              <Metric label="Earnings Yield" value={pct(stock.earningsYield)} />
              <Metric label="P/L" value={stock.pL > 0 ? stock.pL.toFixed(2) : '-'} />
              <Metric label="P/VP" value={stock.pVp.toFixed(2)} />
              <Metric label="P/VP médio" value={stock.averagePVp.toFixed(2)} />
              <Metric label="ROE" value={pct(stock.roe)} />
              <Metric label="ROE médio" value={pct(stock.averageRoe)} />
              <Metric label="ROIC" value={pct(stock.roic)} />
              <Metric label="DY médio" value={pct(stock.averageDividendYield)} />
              <Metric label="Anos de dividendos" value={stock.yearsPayingDividends} />
            </SimpleGrid>
          </Stack>
        </Card>)}
        {!loading && !displayedData.length && <Text c="dimmed" ta="center" py="xl">Nenhuma recomendação disponível.</Text>}
        </Stack>
      </ScrollArea>
    </Stack>
  </Card>;
}
