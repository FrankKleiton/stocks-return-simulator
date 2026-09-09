'use client';

import { ActionIcon, Tooltip, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { useMounted } from '@mantine/hooks';
import { Moon, Sun } from 'lucide-react';

export default function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('dark');
  // The provider reads the persisted scheme synchronously on the client, so it can differ from the
  // server default. Render the default until mounted so server and client markup match.
  const mounted = useMounted();
  const isDark = mounted ? computed === 'dark' : true;

  return <Tooltip label={`Mudar para modo ${isDark ? 'claro' : 'escuro'}`}>
    <ActionIcon
      aria-label={`Mudar para modo ${isDark ? 'claro' : 'escuro'}`}
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
