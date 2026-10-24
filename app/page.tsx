'use client';
import { useEffect, useRef, useState } from 'react';
import { Badge, Box, Container, Group, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import PortfolioBuilder from '@/components/PortfolioBuilder';
import SimulationForm from '@/components/SimulationForm';
import ResultsDashboard from '@/components/ResultsDashboard';
import ColorSchemeToggle from '@/components/ColorSchemeToggle';
import { LineChart, SlidersHorizontal, WalletCards } from 'lucide-react';
import type { PortfolioItem, SimulationResult } from '@/lib/types';

const workflow = [
  { step: '01', title: 'Montar', description: 'Adicione ações, FIIs, ETFs ou stocks e defina o peso de cada um.', icon: WalletCards },
  { step: '02', title: 'Configurar', description: 'Escolha o período, o investimento inicial, os aportes e o que fazer com os dividendos.', icon: SlidersHorizontal },
  { step: '03', title: 'Analisar', description: 'Compare retorno, renda de dividendos, posições e transações ao longo do tempo.', icon: LineChart }
];

export default function Home() {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [result, setResult] = useState<SimulationResult>();
  const [running, setRunning] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('portfolio');
    if (saved) setPortfolio(JSON.parse(saved));
  }, []);

  // The results render below the fold on wide screens, so bring them into view when a run finishes.
  useEffect(() => {
    if (result) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [result]);

  return <Container size="xl" px={{ base: 'xs', sm: 'md', lg: 'xl' }} py={{ base: 'md', sm: 'xl' }}>
    <Stack gap="xl">
      <Box component="header" className="hero-shell" p={{ base: 'md', sm: 'xl' }}>
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
          <Stack gap="sm">
            <Group gap="xs">
              <Badge color="cyber" variant="light" size="lg">Dados do Investidor10</Badge>
              <Badge color="plasma" variant="light" size="lg">Ações B3 · FIIs · ETFs · Stocks US</Badge>
            </Group>
            <Title className="hero-title" order={1} fz={{ base: 32, sm: 44, md: 52 }} lh={1.05}>Simulador histórico de carteira</Title>
            <Text maw={720} c="dimmed" fz={{ base: 'sm', sm: 'md' }} lh={1.6}>Monte uma carteira, escolha o período e veja como ela teria se comportado com aportes mensais e dividendos reinvestidos ou recebidos em dinheiro.</Text>
          </Stack>
          <ColorSchemeToggle />
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mt="lg" visibleFrom="sm">
          {workflow.map(({ step, title, description, icon: Icon }) => <Box className="workflow-card" p="md" key={step}>
            <Group gap="sm" align="flex-start" wrap="nowrap">
              <ThemeIcon variant="light" color="cyber" radius="lg" size="lg"><Icon size={18} /></ThemeIcon>
              <div>
                <Text size="xs" fw={900} c="cyber.3">{step} · {title}</Text>
                <Text size="sm" c="dimmed" mt={2}>{description}</Text>
              </div>
            </Group>
          </Box>)}
        </SimpleGrid>
      </Box>

      <div className="dashboard-grid">
        <Box id="portfolio-builder"><PortfolioBuilder items={portfolio} setItems={setPortfolio}/></Box>
        <Box className="dashboard-aside"><SimulationForm holdings={portfolio} onResult={setResult} onRunningChange={setRunning}/></Box>
      </div>
      <div ref={resultsRef}><ResultsDashboard result={result} loading={running}/></div>
      <Text pb="xl" size="xs" c="dimmed">Apenas para fins educacionais. Os resultados são aproximações históricas, não são conselhos de investimento. Ativos cotados em dólar (stocks e ETFs globais) são convertidos para a moeda do resultado pela PTAX diária do Banco Central; escolha "Dólar (US$)" no simulador para ver tudo em dólar.</Text>
    </Stack>
  </Container>;
}
