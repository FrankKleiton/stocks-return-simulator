'use client';
import { useEffect, useState } from 'react';
import { Badge, Box, Card, Container, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import RecommendationTable from '@/components/RecommendationTable';
import PortfolioBuilder from '@/components/PortfolioBuilder';
import SimulationForm from '@/components/SimulationForm';
import ResultsDashboard from '@/components/ResultsDashboard';
import type { PortfolioItem, Recommendation, SimulationResult } from '@/lib/types';

const workflow = [
  ['01', 'Build', 'Create a portfolio and assign allocations.'],
  ['02', 'Simulate', 'Run historical scenarios with dividends.'],
  ['03', 'Discover', 'Use ranked quality and valuation ideas.']
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
      <Box component="header" py={{ base: 'sm', sm: 'xl' }}>
        <Group gap="xs" mb="md">
          <Badge color="cyber" variant="light">Status Invest data</Badge>
          <Badge color="plasma" variant="light">Chart.js analytics</Badge>
          <Badge color="matrix" variant="light">Dividend simulator</Badge>
        </Group>
        <Text size="xs" fw={700} tt="uppercase" c="cyber.3" style={{ letterSpacing: '0.22em' }}>Brazil Market Intelligence</Text>
        <Title className="hero-title" order={1} mt="sm" fz={{ base: 36, sm: 52, md: 72 }} lh={0.98}>Portfolio backtesting for Brazilian stocks</Title>
        <Text mt="md" maw={860} c="gray.3" fz={{ base: 'sm', sm: 'lg' }}>A professional analytics workspace to build portfolios, simulate historical returns, compare dividend strategies, and discover companies with strong quality and valuation signals.</Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mt="xl">
          {workflow.map(([step, title, description]) => <Card className="workflow-card" withBorder radius="lg" p="md" key={step}>
            <Text size="xs" fw={900} c="cyber.3">{step}</Text>
            <Text fw={800} fz="lg" mt={4}>{title}</Text>
            <Text size="sm" c="dimmed" mt={2}>{description}</Text>
          </Card>)}
        </SimpleGrid>
      </Box>

      <Stack gap="md">
        <PortfolioBuilder items={portfolio} setItems={setPortfolio}/>
        <SimulationForm holdings={portfolio} onResult={setResult}/>
        <ResultsDashboard result={result}/>
        <RecommendationTable data={recommendations} loading={loading} onAdd={add}/>
      </Stack>
      <Text pb="xl" size="xs" c="dimmed">Educational analytics only. Recommendations are model suggestions, not investment advice.</Text>
    </Stack>
  </Container>;
}
