import type { ThemePreference } from './types';

const THEME_STORAGE_KEY = 'util_hub_theme';
const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');

export function getThemePreference(): ThemePreference {
  if (window.desktopTheme) return window.desktopTheme.getPreference();
  try {
    const savedPreference = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedPreference === 'light' || savedPreference === 'dark') return savedPreference;
  } catch {}
  return 'system';
}

function applyTheme(preference: ThemePreference) {
  const isDark = preference === 'dark' || (preference === 'system' && systemPrefersDark.matches);
  document.documentElement.classList.toggle('dark', isDark);
}

export async function setThemePreference(preference: ThemePreference) {
  if (window.desktopTheme) await window.desktopTheme.setPreference(preference);
  else try { localStorage.setItem(THEME_STORAGE_KEY, preference); } catch {}
  applyTheme(preference);
}

systemPrefersDark.addEventListener('change', () => applyTheme(getThemePreference()));
applyTheme(getThemePreference());
