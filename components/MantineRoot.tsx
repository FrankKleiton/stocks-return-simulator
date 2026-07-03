'use client';

import { MantineProvider, createTheme } from '@mantine/core';
import type { ReactNode } from 'react';

const theme = createTheme({
  primaryColor: 'cyber',
  defaultRadius: 'md',
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  colors: {
    cyber: ['#e6fbff', '#bff4ff', '#8feaff', '#5bddff', '#22d3ee', '#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63'],
    plasma: ['#f5f3ff', '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95'],
    matrix: ['#ecfdf5', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46', '#064e3b']
  },
  defaultGradient: { from: 'cyber.5', to: 'plasma.5', deg: 135 }
});

export default function MantineRoot({ children }: { children: ReactNode }) {
  return <MantineProvider defaultColorScheme="dark" theme={theme}>{children}</MantineProvider>;
}
