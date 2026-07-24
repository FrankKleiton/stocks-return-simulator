import '@mantine/core/styles.css';
import './globals.css';
import type { Metadata } from 'next';
import MantineRoot from '@/components/MantineRoot';

export const metadata: Metadata = { title: 'Simulador de Retorno de Ações Brasileiras', description: 'Simulação histórica de carteira com dados do Status Invest' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="pt-BR"><body><MantineRoot>{children}</MantineRoot></body></html>; }
