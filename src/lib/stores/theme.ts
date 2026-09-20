import { writable } from 'svelte/store';

export type ThemePreference = 'light' | 'dark' | 'system';
export const resolvedTheme = writable<'light' | 'dark'>('light');

function getStoredTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const value = localStorage.getItem('o3d_theme');
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

function applyTheme(resolved: 'light' | 'dark') {
  resolvedTheme.set(resolved);
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

function createThemeStore() {
  const initial = getStoredTheme();
  const { subscribe, set } = writable<ThemePreference>(initial);

  // Apply on creation
  applyTheme(resolveTheme(initial));

  // Listen for system theme changes
  if (typeof window !== 'undefined') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => {
      // Re-read current preference
      const pref = getStoredTheme();
      if (pref === 'system') {
        applyTheme(resolveTheme('system'));
      }
    });
  }

  return {
    subscribe,
    set(value: ThemePreference) {
      set(value);
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('o3d_theme', value); } catch {}
      }
      applyTheme(resolveTheme(value));
    },
  };
}

export const themePreference = createThemeStore();
