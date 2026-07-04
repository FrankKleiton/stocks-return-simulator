import '@mantine/core/styles.css';
import './globals.css';
import type { Metadata } from 'next';
import { ColorSchemeScript } from '@mantine/core';
import MantineRoot from '@/components/MantineRoot';

export const metadata: Metadata = { title: 'Brazil Stock Return Simulator', description: 'Historical portfolio simulation with Status Invest data' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><head><ColorSchemeScript defaultColorScheme="dark" /></head><body><MantineRoot>{children}</MantineRoot></body></html>; }
