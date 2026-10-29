import type { ThemePreference } from './types';

const THEME_STORAGE_KEY = 'util_hub_theme';

/**
 * The app follows the POP design system (design.md), which is a
 * light-only, flat-color language. Dark mode is intentionally not
 * supported anymore: whatever is stored or reported, we always render
 * the POP paper palette.
 */
export function getThemePreference(): ThemePreference {
  try { localStorage.removeItem(THEME_STORAGE_KEY); } catch {}
  return 'light';
}

function applyTheme(_preference: ThemePreference) {
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = 'light';
}

export async function setThemePreference(preference: ThemePreference) {
  if (window.desktopTheme) await window.desktopTheme.setPreference(preference);
  applyTheme(preference);
}

applyTheme(getThemePreference());
