'use client';
import { Badge, Button, Card, Group, NumberInput, Stack, Text, TextInput, Title } from '@mantine/core';
import type { PortfolioItem } from '@/lib/types';

export default function PortfolioBuilder({ items, setItems }: { items: PortfolioItem[]; setItems: (x: PortfolioItem[]) => void }) {
  const addManual = (form: FormData) => { const ticker = String(form.get('ticker') || '').toUpperCase().replace(/[^A-Z0-9]/g,''); if (ticker && !items.some(i=>i.ticker===ticker)) setItems([...items, { ticker, allocation: items.length ? 0 : 100 }]); };
  const equal = () => setItems(items.map(i => ({ ...i, allocation: Math.round((100/items.length)*100)/100 })));
  const save = () => { localStorage.setItem('portfolio', JSON.stringify(items)); alert('Carteira salva localmente.'); };
  return <Card withBorder shadow="md" radius="lg" p={{ base: 'sm', sm: 'md' }}>
    <Stack gap="md">
      <Group justify="space-between" align="center"><Title order={2} fz={{ base: 'lg', sm: 'xl' }}>Montador de carteira</Title><Group gap="xs"><Button variant="light" size="xs" onClick={equal} disabled={!items.length}>Igualar</Button><Button variant="outline" size="xs" onClick={save}>Salvar</Button></Group></Group>
      <form action={addManual}><Group gap="xs" wrap="nowrap"><TextInput name="ticker" placeholder="Adicionar ação, ex: WEGE3" style={{ flex: 1, minWidth: 0 }}/><Button type="submit">Adicionar</Button></Group></form>
      <Stack gap="xs">{items.map((it, idx) => <Group key={it.ticker} gap="xs" wrap="nowrap" p="sm" className="portfolio-stock-row"><Badge size="lg" radius="sm" variant="gradient" gradient={{ from: 'cyber.5', to: 'plasma.5', deg: 135 }} miw={76}>{it.ticker}</Badge><NumberInput min={0} max={100} value={it.allocation} onChange={v => setItems(items.map((x,i)=>i===idx?{...x,allocation:Number(v) || 0}:x))} suffix="%" style={{ flex: 1, minWidth: 0 }}/><Button variant="light" color="red" size="xs" onClick={() => setItems(items.filter(x=>x.ticker!==it.ticker))}>Remover</Button></Group>)}{!items.length && <Text size="sm" c="dimmed">Adicione ações pelas recomendações ou busque manualmente.</Text>}</Stack>
    </Stack>
  </Card>;
}
