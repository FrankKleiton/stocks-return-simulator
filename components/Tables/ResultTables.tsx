'use client';
import { Card, ScrollArea, SimpleGrid, Table, Title } from '@mantine/core';
import type { SimulationResult } from '@/lib/types';
import { brl } from '@/lib/metrics';
export default function ResultTables({ result }: { result: SimulationResult }) {
  return <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
    <Card withBorder shadow="md" radius="lg" p="md"><Title order={3} fz="md" mb="sm">Holdings</Title><ScrollArea><Table miw={520} fz="sm"><Table.Tbody>{result.holdings.map(h=><Table.Tr key={h.ticker}><Table.Td fw={700}>{h.ticker}</Table.Td><Table.Td>{h.shares.toFixed(4)} shares</Table.Td><Table.Td>{brl(h.value)}</Table.Td><Table.Td>{h.returnPct.toFixed(1)}%</Table.Td></Table.Tr>)}</Table.Tbody></Table></ScrollArea></Card>
    <Card withBorder shadow="md" radius="lg" p="md"><Title order={3} fz="md" mb="sm">Transactions</Title><ScrollArea h={360}><Table miw={520} fz="sm"><Table.Tbody>{result.transactions.slice(-200).reverse().map((t,i)=><Table.Tr key={i}><Table.Td>{t.date}</Table.Td><Table.Td>{t.ticker}</Table.Td><Table.Td>{t.type}</Table.Td><Table.Td>{brl(t.amount)}</Table.Td></Table.Tr>)}</Table.Tbody></Table></ScrollArea></Card>
    <Card withBorder shadow="md" radius="lg" p="md" style={{ gridColumn: '1 / -1' }}><Title order={3} fz="md" mb="sm">Dividend history</Title><ScrollArea h={360}><Table miw={620} fz="sm"><Table.Tbody>{result.dividends.map((d,i)=><Table.Tr key={i}><Table.Td>{d.paymentDate}</Table.Td><Table.Td>{d.ticker}</Table.Td><Table.Td>{d.type}</Table.Td><Table.Td>{brl(d.value)}</Table.Td></Table.Tr>)}</Table.Tbody></Table></ScrollArea></Card>
  </SimpleGrid>;
}
