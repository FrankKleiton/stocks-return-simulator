import '@mantine/core/styles.css';
import './globals.css';
import type { Metadata } from 'next';
import MantineRoot from '@/components/MantineRoot';

export const metadata: Metadata = { title: 'Brazil Stock Return Simulator', description: 'Historical portfolio simulation with Status Invest data' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body><MantineRoot>{children}</MantineRoot></body></html>; }
