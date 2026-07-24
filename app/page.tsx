'use client';
import { useEffect, useState } from 'react';
import { Badge, Box, Button, Card, Container, Group, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import RecommendationTable from '@/components/RecommendationTable';
import PortfolioBuilder from '@/components/PortfolioBuilder';
import SimulationForm from '@/components/SimulationForm';
import ResultsDashboard from '@/components/ResultsDashboard';
import WalletComparison from '@/components/WalletComparison';
import ColorSchemeToggle from '@/components/ColorSchemeToggle';
import { BarChart3, LineChart, ShieldCheck, Sparkles, WalletCards } from 'lucide-react';
import type { PortfolioItem, Recommendation, SimulationResult } from '@/lib/types';

const workflow = [
  { step: '01', title: 'Montar', description: 'Crie uma carteira e defina as alocações.', icon: WalletCards },
  { step: '02', title: 'Simular', description: 'Rode cenários históricos com dividendos.', icon: LineChart },
  { step: '03', title: 'Descobrir', description: 'Use sinais classificados de qualidade, valuation e FCL.', icon: Sparkles }
];

const highlights = [
  ['80+', 'ações classificadas'],
  ['10a', 'janela de FCL'],
  ['3', 'cenários de valuation']
];

export default function Home() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [result, setResult] = useState<SimulationResult>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('portfolio');
    if (saved) setPortfolio(JSON.parse(saved));
    fetch('/api/stocks?recommend=1&limit=80').then(r => r.json()).then(setRecommendations).finally(() => setLoading(false));
  }, []);

  const add = (r: Recommendation) => setPortfolio(p => p.some(x => x.ticker === r.ticker) ? p : [...p, { ticker: r.ticker, name: r.companyName, allocation: p.length ? 0 : 100 }]);

  return <Container size="xl" px={{ base: 'xs', sm: 'md', lg: 'xl' }} py={{ base: 'md', sm: 'xl' }}>
    <Stack gap="xl">
      <Box component="header" className="hero-shell" p={{ base: 'md', sm: 'xl' }}>
        <Group justify="space-between" align="center" gap="md" mb="xl">
          <Group gap="xs">
            <Badge color="cyber" variant="light" size="lg">Dados do Status Invest</Badge>
            <Badge color="plasma" variant="light" size="lg">Análises com Chart.js</Badge>
            <Badge color="matrix" variant="light" size="lg">Simulador de dividendos</Badge>
          </Group>
          <ColorSchemeToggle />
        </Group>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing={{ base: 'xl', md: 48 }} verticalSpacing="xl">
          <Stack gap="lg" justify="center">
            <Group gap="xs">
              <ThemeIcon variant="light" color="cyber" radius="xl" size="lg"><BarChart3 size={18} /></ThemeIcon>
              <Text size="xs" fw={800} tt="uppercase" c="cyber.3" style={{ letterSpacing: '0.22em' }}>Inteligência do Mercado Brasileiro</Text>
            </Group>
            <Title className="hero-title" order={1} fz={{ base: 38, sm: 58, md: 78 }} lh={0.94}>Invista com mais clareza histórica</Title>
            <Text maw={760} c="dimmed" fz={{ base: 'md', sm: 'xl' }} lh={1.65}>Monte carteiras de ações brasileiras, faça backtests de cenários com dividendos e analise sinais transparentes de qualidade, valuation e fluxo de caixa livre histórico em um só lugar.</Text>
            <Group gap="sm">
              <Button size="md" radius="xl" onClick={() => document.getElementById('recommendations')?.scrollIntoView({ behavior: 'smooth' })}>Explorar recomendações</Button>
              <Button size="md" radius="xl" variant="light" color="gray" onClick={() => document.getElementById('portfolio-builder')?.scrollIntoView({ behavior: 'smooth' })}>Montar carteira</Button>
            </Group>
          </Stack>

          <Card className="hero-insight-card" withBorder radius="xl" p="xl">
            <Stack gap="lg">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text size="xs" fw={800} tt="uppercase" c="dimmed">Resumo analítico</Text>
                  <Title order={2} fz={{ base: 24, sm: 32 }}>Visão de qualidade + fluxo de caixa</Title>
                </div>
                <ThemeIcon variant="gradient" gradient={{ from: 'cyber', to: 'plasma' }} radius="xl" size={48}><ShieldCheck size={24} /></ThemeIcon>
              </Group>
              <SimpleGrid cols={3} spacing="sm">
                {highlights.map(([value, label]) => <Box className="hero-stat" key={label} p="md">
                  <Text fw={900} fz={{ base: 24, sm: 30 }}>{value}</Text>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{label}</Text>
                </Box>)}
              </SimpleGrid>
              <Text size="sm" c="dimmed">Feito para evitar falsa precisão: sem rótulos de compra/venda, sem valor justo por ação fictício — apenas premissas visíveis e alertas úteis.</Text>
            </Stack>
          </Card>
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mt="xl">
          {workflow.map(({ step, title, description, icon: Icon }) => <Card className="workflow-card" withBorder radius="xl" p="lg" key={step}>
            <Group gap="sm" align="flex-start">
              <ThemeIcon variant="light" color="cyber" radius="lg" size="lg"><Icon size={18} /></ThemeIcon>
              <div>
                <Text size="xs" fw={900} c="cyber.3">{step}</Text>
                <Text fw={800} fz="lg" mt={2}>{title}</Text>
                <Text size="sm" c="dimmed" mt={2}>{description}</Text>
              </div>
            </Group>
          </Card>)}
        </SimpleGrid>
      </Box>

      <Stack gap="lg">
        <Box id="portfolio-builder"><PortfolioBuilder items={portfolio} setItems={setPortfolio}/></Box>
        <SimulationForm holdings={portfolio} onResult={setResult}/>
        <ResultsDashboard result={result}/>
        <WalletComparison data={recommendations} loading={loading}/>
        <Box id="recommendations"><RecommendationTable data={recommendations} loading={loading} onAdd={add}/></Box>
      </Stack>
      <Text pb="xl" size="xs" c="dimmed">Apenas para fins educacionais. As recomendações são sugestões do modelo, não são conselhos de investimento.</Text>
    </Stack>
  </Container>;
}
