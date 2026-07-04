'use client';

import { ActionIcon, Tooltip, useMantineColorScheme } from '@mantine/core';
import { Moon, Sun } from 'lucide-react';

export default function ColorSchemeToggle() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  return <Tooltip label={`Switch to ${isDark ? 'light' : 'dark'} mode`}>
    <ActionIcon
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      variant="light"
      color={isDark ? 'yellow' : 'dark'}
      size="lg"
      radius="xl"
      onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </ActionIcon>
  </Tooltip>;
}
