import { useMemo, useSyncExternalStore } from 'react';
import { useStore } from '../../store/useStore';

function getSystemDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function subscribeToSystemTheme(callback: () => void) {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

export function useResolvedTheme(): 'light' | 'dark' {
  const themeMode = useStore((s) => s.settings.themeMode);
  const systemDark = useSyncExternalStore(subscribeToSystemTheme, getSystemDark);

  return useMemo(() => {
    if (themeMode === 'system') return systemDark ? 'dark' : 'light';
    return themeMode;
  }, [themeMode, systemDark]);
}
