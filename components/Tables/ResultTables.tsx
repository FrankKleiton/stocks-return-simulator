'use client';
import { Badge, Card, Group, ScrollArea, SimpleGrid, Table, Text, Title } from '@mantine/core';
import type { Currency, SimulationResult } from '@/lib/types';
import { brDate, currencySymbol, money, pct, quantity } from '@/lib/metrics';

const transactionTypeLabels: Record<string, string> = { BUY: 'Compra', DIVIDEND: 'Dividendo', REINVEST: 'Reinvestimento', CONTRIBUTION: 'Aporte' };
const MAX_TRANSACTIONS = 200;

const num = { ta: 'right' as const, style: { fontVariantNumeric: 'tabular-nums' } };
const Signed = ({ value }: { value: number }) => <Text span fw={600} c={value >= 0 ? 'matrix.4' : 'red.5'} inherit>{pct(value)}</Text>;
const currencyColor: Record<Currency, string> = { BRL: 'cyber', USD: 'plasma' };

export default function ResultTables({ result }: { result: SimulationResult }) {
  const brl = (n: number) => money(n, result.currency);
  const symbol = currencySymbol(result.currency);
  // When an asset was converted, its final value is also shown in the currency it is quoted in.
  const mixed = result.holdings.some(h => h.currency !== result.currency);
  const transactions = result.transactions.slice(-MAX_TRANSACTIONS).reverse();
  const dividends = [...result.dividends].sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || a.ticker.localeCompare(b.ticker));

  return <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
    <Card withBorder shadow="md" radius="lg" p={{ base: 'sm', sm: 'md' }}>
      <Title order={3} fz="md" mb="sm">Posições</Title>
      <ScrollArea>
        <Table miw={mixed ? 680 : 560} fz="sm" verticalSpacing="xs">
          <Table.Thead><Table.Tr><Table.Th>Ativo</Table.Th><Table.Th {...num}>Quantidade</Table.Th><Table.Th {...num}>Custo ({symbol})</Table.Th><Table.Th {...num}>Valor ({symbol})</Table.Th>{mixed && <Table.Th {...num}>Valor na moeda original</Table.Th>}<Table.Th {...num}>Dividendos ({symbol})</Table.Th><Table.Th {...num}>Retorno</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{result.holdings.map(h => <Table.Tr key={h.ticker}>
            <Table.Td fw={700}><Group gap={6} wrap="nowrap">{h.ticker}<Badge size="xs" radius="sm" variant="outline" color={currencyColor[h.currency]} style={{ flex: '0 0 auto' }}>{currencySymbol(h.currency)}</Badge></Group></Table.Td>
            <Table.Td {...num}>{quantity(h.shares)}</Table.Td><Table.Td {...num}>{brl(h.cost)}</Table.Td><Table.Td {...num}>{brl(h.value)}</Table.Td>
            {mixed && <Table.Td {...num} c={h.currency === result.currency ? 'dimmed' : undefined}>{h.currency === result.currency ? '—' : money(h.nativeValue, h.currency)}</Table.Td>}
            <Table.Td {...num}>{brl(h.dividends)}</Table.Td><Table.Td {...num}><Signed value={h.returnPct}/></Table.Td>
          </Table.Tr>)}</Table.Tbody>
        </Table>
      </ScrollArea>
    </Card>
    <Card withBorder shadow="md" radius="lg" p={{ base: 'sm', sm: 'md' }}>
      <Title order={3} fz="md" mb="sm">Transações <Text span size="sm" c="dimmed" fw={400}>· {result.transactions.length > MAX_TRANSACTIONS ? `últimas ${MAX_TRANSACTIONS} de ${result.transactions.length}` : result.transactions.length}</Text></Title>
      <ScrollArea h={360}>
        <Table miw={520} fz="sm" verticalSpacing="xs" stickyHeader>
          <Table.Thead><Table.Tr><Table.Th>Data</Table.Th><Table.Th>Ativo</Table.Th><Table.Th>Tipo</Table.Th><Table.Th {...num}>Valor ({symbol})</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{transactions.map((t, i) => <Table.Tr key={i}>
            <Table.Td>{brDate(t.date)}</Table.Td><Table.Td fw={600}>{t.ticker}</Table.Td><Table.Td>{transactionTypeLabels[t.type] ?? t.type}</Table.Td><Table.Td {...num}>{brl(t.amount)}</Table.Td>
          </Table.Tr>)}</Table.Tbody>
        </Table>
      </ScrollArea>
    </Card>
    <Card withBorder shadow="md" radius="lg" p={{ base: 'sm', sm: 'md' }} style={{ gridColumn: '1 / -1' }}>
      <Title order={3} fz="md" mb="sm">Histórico de proventos <Text span size="sm" c="dimmed" fw={400}>· {dividends.length} pagamentos por cota/ação</Text></Title>
      <ScrollArea h={360}>
        <Table miw={620} fz="sm" verticalSpacing="xs" stickyHeader>
          <Table.Thead><Table.Tr><Table.Th>Pagamento</Table.Th><Table.Th>Data com</Table.Th><Table.Th>Ativo</Table.Th><Table.Th>Tipo</Table.Th><Table.Th {...num}>Valor por cota ({symbol})</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{dividends.map((d, i) => <Table.Tr key={i}>
            <Table.Td>{brDate(d.paymentDate)}</Table.Td><Table.Td c="dimmed">{brDate(d.date)}</Table.Td><Table.Td fw={600}>{d.ticker}</Table.Td><Table.Td>{d.type ?? '-'}</Table.Td><Table.Td {...num}>{d.value.toLocaleString('pt-BR', { style: 'currency', currency: result.currency, minimumFractionDigits: 2, maximumFractionDigits: 4 })}</Table.Td>
          </Table.Tr>)}</Table.Tbody>
        </Table>
      </ScrollArea>
    </Card>
  </SimpleGrid>;
}
