'use client';
import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Alert, Badge, Button, Card, Group, NumberInput, Popover, Stack, Text, TextInput, Title, Tooltip } from '@mantine/core';
import { Info, Trash2 } from 'lucide-react';
import { ApiError, errorMessage, fetchJson } from '@/lib/clientFetch';
import { currencySymbol } from '@/lib/metrics';
import type { AssetInfo, Currency, PortfolioItem } from '@/lib/types';

const allocationTotal = (items: PortfolioItem[]) => Math.round(items.reduce((sum, item) => sum + item.allocation, 0) * 100) / 100;
const currencyColor: Record<Currency, string> = { BRL: 'cyber', USD: 'plasma' };

export default function PortfolioBuilder({ items, setItems }: { items: PortfolioItem[]; setItems: (x: PortfolioItem[]) => void }) {
  // Asset lookups resolve asynchronously, so updates are applied to the latest list rather than a stale closure.
  const latest = useRef(items);
  latest.current = items;
  const pending = useRef(new Set<string>());
  const [issue, setIssue] = useState<string>();

  /** Fills in the name and currency of a ticker; unknown tickers are removed again so they do not break the simulation later. */
  async function resolve(ticker: string) {
    if (pending.current.has(ticker)) return;
    pending.current.add(ticker);
    try {
      const info = await fetchJson<AssetInfo>(`/api/asset?ticker=${encodeURIComponent(ticker)}`);
      setItems(latest.current.map(item => item.ticker === ticker ? { ...item, name: info.name, currency: info.currency } : item));
    } catch (error) {
      if (error instanceof ApiError && error.notFound) {
        setItems(latest.current.filter(item => item.ticker !== ticker));
        setIssue(`${ticker} não foi encontrado no Investidor10. Confira o código do ativo.`);
      } else {
        setIssue(`Não foi possível consultar ${ticker} agora (${errorMessage(error)}). Ele continua na carteira e será consultado de novo na simulação.`);
      }
    } finally {
      pending.current.delete(ticker);
    }
  }

  // Wallets saved before currencies existed, or added while offline, are completed in the background.
  useEffect(() => { items.filter(item => !item.currency).forEach(item => void resolve(item.ticker)); }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const addManual = (form: FormData) => {
    const ticker = String(form.get('ticker') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!ticker || items.some(i => i.ticker === ticker)) return;
    setIssue(undefined);
    setItems([...items, { ticker, allocation: items.length ? 0 : 100 }]);
  };
  const equal = () => setItems(items.map(i => ({ ...i, allocation: Math.round((100 / items.length) * 100) / 100 })));

  // "Salvar" confirms inline for a moment instead of with a blocking alert.
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (!saved) return; const timer = setTimeout(() => setSaved(false), 2000); return () => clearTimeout(timer); }, [saved]);
  const save = () => { localStorage.setItem('portfolio', JSON.stringify(items)); setSaved(true); };

  // Clearing is a two-step action so a stray click cannot wipe a hand-built wallet.
  const [confirmClear, setConfirmClear] = useState(false);
  const clear = () => { setItems([]); setConfirmClear(false); };

  const total = allocationTotal(items);
  const balanced = Math.abs(total - 100) < 0.01;
  const currencies = new Set(items.map(item => item.currency).filter(Boolean));

  return <Card withBorder shadow="md" radius="lg" p={{ base: 'sm', sm: 'md' }}>
    <Stack gap="md">
      <Group justify="space-between" align="center" gap="xs">
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
      {issue && <Alert color="yellow" variant="light" withCloseButton onClose={() => setIssue(undefined)} py="xs">{issue}</Alert>}
      <Stack gap="xs">
        {items.map((it, idx) => <Group key={it.ticker} gap="xs" wrap="nowrap" p={{ base: 'xs', sm: 'sm' }} className="portfolio-stock-row">
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Group gap="xs" wrap="nowrap">
              <Badge size="lg" radius="sm" variant="gradient" gradient={{ from: 'cyber.5', to: 'plasma.5', deg: 135 }} miw={76}>{it.ticker}</Badge>
              {it.currency && <Badge size="sm" radius="sm" variant="outline" color={currencyColor[it.currency]} title={`Cotado em ${it.currency === 'USD' ? 'dólar' : 'real'}`}>{currencySymbol(it.currency)}</Badge>}
            </Group>
            <Text size="xs" c="dimmed" lineClamp={1}>{it.name ?? (it.currency ? '' : 'Consultando ativo…')}</Text>
          </Stack>
          <NumberInput aria-label={`Alocação de ${it.ticker}`} min={0} max={100} value={it.allocation} onChange={v => setItems(items.map((x, i) => i === idx ? { ...x, allocation: Number(v) || 0 } : x))} suffix="%" decimalScale={2} w={{ base: 92, sm: 140 }} hideControls/>
          <Tooltip label={`Remover ${it.ticker}`}>
            <ActionIcon variant="light" color="red" size="lg" aria-label={`Remover ${it.ticker}`} onClick={() => setItems(items.filter(x => x.ticker !== it.ticker))}><Trash2 size={16} /></ActionIcon>
          </Tooltip>
        </Group>)}
        {!items.length && <Text size="sm" c="dimmed">Adicione ativos pelo campo acima: ações (WEGE3), FIIs (XPML11), ETFs (BOVA11, EXUS) ou stocks (AAPL).</Text>}
        {items.length > 0 && <Text size="xs" c={balanced ? 'dimmed' : 'yellow.6'}>
          Total alocado: {total}%{balanced ? '' : ' · os pesos serão ajustados proporcionalmente para 100% na simulação.'}
        </Text>}
        {currencies.size > 1 && <Alert color="plasma" variant="light" icon={<Info size={18} />} py="xs" title="Carteira com ativos em R$ e US$">
          Os valores são convertidos para a &ldquo;Moeda do resultado&rdquo; pela PTAX de cada dia (Banco Central); a tabela de posições mostra cada ativo também na moeda original.
        </Alert>}
      </Stack>
    </Stack>
  </Card>;
}
