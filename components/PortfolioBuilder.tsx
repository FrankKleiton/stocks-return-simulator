'use client';
import { useEffect, useState } from 'react';
import { Badge, Button, Card, Group, NumberInput, Popover, Stack, Text, TextInput, Title } from '@mantine/core';
import type { PortfolioItem } from '@/lib/types';

const allocationTotal = (items: PortfolioItem[]) => Math.round(items.reduce((sum, item) => sum + item.allocation, 0) * 100) / 100;

export default function PortfolioBuilder({ items, setItems }: { items: PortfolioItem[]; setItems: (x: PortfolioItem[]) => void }) {
  const addManual = (form: FormData) => { const ticker = String(form.get('ticker') || '').toUpperCase().replace(/[^A-Z0-9]/g,''); if (ticker && !items.some(i=>i.ticker===ticker)) setItems([...items, { ticker, allocation: items.length ? 0 : 100 }]); };
  const equal = () => setItems(items.map(i => ({ ...i, allocation: Math.round((100/items.length)*100)/100 })));

  // "Salvar" confirms inline for a moment instead of with a blocking alert.
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (!saved) return; const timer = setTimeout(() => setSaved(false), 2000); return () => clearTimeout(timer); }, [saved]);
  const save = () => { localStorage.setItem('portfolio', JSON.stringify(items)); setSaved(true); };

  // Clearing is a two-step action so a stray click cannot wipe a hand-built wallet.
  const [confirmClear, setConfirmClear] = useState(false);
  const clear = () => { setItems([]); setConfirmClear(false); };

  const total = allocationTotal(items);
  const balanced = Math.abs(total - 100) < 0.01;

  return <Card withBorder shadow="md" radius="lg" p={{ base: 'sm', sm: 'md' }}>
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Title order={2} fz={{ base: 'lg', sm: 'xl' }}>Montador de carteira</Title>
        <Group gap="xs">
          <Button variant="light" size="xs" onClick={equal} disabled={!items.length}>Igualar</Button>
          <Button variant={saved ? 'light' : 'outline'} color={saved ? 'matrix' : undefined} size="xs" onClick={save}>{saved ? 'Salvo ✓' : 'Salvar'}</Button>
          <Popover opened={confirmClear} onChange={setConfirmClear} position="bottom-end" withArrow shadow="md">
            <Popover.Target><Button variant="light" color="red" size="xs" onClick={() => setConfirmClear(o => !o)} disabled={!items.length}>Limpar</Button></Popover.Target>
            <Popover.Dropdown><Stack gap="xs"><Text size="sm">Remover todos os {items.length} ativos da carteira?</Text><Group gap="xs" justify="flex-end"><Button variant="subtle" size="xs" onClick={() => setConfirmClear(false)}>Cancelar</Button><Button color="red" size="xs" onClick={clear}>Remover tudo</Button></Group></Stack></Popover.Dropdown>
          </Popover>
        </Group>
      </Group>
      <form action={addManual}><Group gap="xs" wrap="nowrap"><TextInput name="ticker" placeholder="Adicionar ativo, ex: WEGE3, XPML11, BOVA11 ou AAPL" autoComplete="off" style={{ flex: 1, minWidth: 0 }}/><Button type="submit">Adicionar</Button></Group></form>
      <Stack gap="xs">
        {items.map((it, idx) => <Group key={it.ticker} gap="xs" wrap="nowrap" p="sm" className="portfolio-stock-row">
          <Badge size="lg" radius="sm" variant="gradient" gradient={{ from: 'cyber.5', to: 'plasma.5', deg: 135 }} miw={76}>{it.ticker}</Badge>
          <NumberInput aria-label={`Alocação de ${it.ticker}`} min={0} max={100} value={it.allocation} onChange={v => setItems(items.map((x,i)=>i===idx?{...x,allocation:Number(v) || 0}:x))} suffix="%" decimalScale={2} style={{ flex: 1, minWidth: 0 }}/>
          <Button variant="light" color="red" size="xs" onClick={() => setItems(items.filter(x=>x.ticker!==it.ticker))}>Remover</Button>
        </Group>)}
        {!items.length && <Text size="sm" c="dimmed">Adicione ativos pelo campo acima: ações (WEGE3), FIIs (XPML11), ETFs (BOVA11, EXUS) ou stocks (AAPL).</Text>}
        {items.length > 0 && <Text size="xs" c={balanced ? 'dimmed' : 'yellow.6'}>
          Total alocado: {total}%{balanced ? '' : ' · os pesos serão ajustados proporcionalmente para 100% na simulação.'}
        </Text>}
      </Stack>
    </Stack>
  </Card>;
}
