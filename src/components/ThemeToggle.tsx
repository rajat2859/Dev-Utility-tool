import React, { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { setThemePreference } from '../theme';
import { cn } from '../lib/utils';

/**
 * Compact light/dark toggle for the dashboard header.
 * Reuses the app's shared theme system (src/theme.ts) rather than
 * introducing a separate theme mechanism.
 */
export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark'),
  );

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    void setThemePreference(next ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={isDark}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={cn(
        'h-8 w-8 shrink-0 rounded-lg border border-slate-200 bg-white text-slate-500',
        'flex items-center justify-center cursor-pointer transition-colors',
        'outline-none hover:border-slate-300 hover:text-slate-900',
        'focus-visible:ring-2 focus-visible:ring-blue-500',
      )}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
