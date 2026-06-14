import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DashboardGrid from './components/DashboardGrid';
import JsonFormatter from './components/tools/JsonFormatter';
import EncoderDecoder from './components/tools/EncoderDecoder';
import GeneratorTool from './components/tools/GeneratorTool';
import TimestampConverter from './components/tools/TimestampConverter';
import TextAnalyzer from './components/tools/TextAnalyzer';
import ColorUtility from './components/tools/ColorUtility';
import ImageConverter from './components/tools/ImageConverter';
import { Home, ArrowLeft, Heart, ShieldAlert, Sparkles, Terminal } from 'lucide-react';

export default function App() {
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const savedFavs = localStorage.getItem('util_hub_favorites');
    if (savedFavs) {
      try {
        setFavorites(JSON.parse(savedFavs));
      } catch {
        // use default
      }
    }

    const savedTheme = localStorage.getItem('util_hub_theme');
    let activeTheme: 'light' | 'dark' = 'light';
    if (savedTheme === 'dark' || savedTheme === 'light') {
      activeTheme = savedTheme;
    } else {
      // Respect system color preference if not saved
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        activeTheme = 'dark';
      }
    }
    setTheme(activeTheme);
    document.documentElement.classList.toggle('dark', activeTheme === 'dark');
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('util_hub_theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  };

  const handleToggleFavorite = (toolId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    let updated: string[];
    if (favorites.includes(toolId)) {
      updated = favorites.filter(id => id !== toolId);
    } else {
      updated = [...favorites, toolId];
    }
    setFavorites(updated);
    localStorage.setItem('util_hub_favorites', JSON.stringify(updated));
  };

  const renderActiveTool = () => {
    switch (activeView) {
      case 'json':
        return <JsonFormatter />;
      case 'encoding':
        return <EncoderDecoder />;
      case 'generator':
        return <GeneratorTool />;
      case 'timestamp':
        return <TimestampConverter />;
      case 'text':
        return <TextAnalyzer />;
      case 'color':
        return <ColorUtility />;
      case 'image':
        return <ImageConverter />;
      default:
        return (
          <DashboardGrid
            onSelectTool={setActiveView}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            userEmail="stavro3804@gmail.com"
          />
        );
    }
  };

  const getToolTitle = () => {
    switch (activeView) {
      case 'json':
        return 'JSON Formatter';
      case 'encoding':
        return 'Base64 & Hash';
      case 'generator':
        return 'Secure Generators';
      case 'timestamp':
        return 'Epoch Converter';
      case 'text':
        return 'Text Metrics';
      case 'color':
        return 'Contrast & Palette';
      case 'image':
        return 'Image Converter';
      default:
        return 'Dashboard';
    }
  };

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 dark:bg-elegant-bg text-slate-900 dark:text-neutral-200 transition-colors duration-200 font-sans flex">
        
        <Sidebar
          currentView={activeView}
          onSelectView={setActiveView}
          favorites={favorites}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          isOpen={sidebarOpen}
          onToggleOpen={() => setSidebarOpen(!sidebarOpen)}
        />

        <div className="flex-1 md:pl-64 flex flex-col min-w-0">
          
          <header className="sticky top-0 z-20 h-16 bg-white/70 dark:bg-elegant-bg/75 backdrop-blur-md border-b border-slate-200/80 dark:border-elegant-border px-6 md:px-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {activeView !== 'dashboard' && (
                <button
                  onClick={() => setActiveView('dashboard')}
                  className="flex items-center justify-center p-2 rounded-xl border border-slate-200 dark:border-elegant-border text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-elegant-card-hover cursor-pointer transition-colors"
                >
                  <ArrowLeft className="h-4.5 w-4.5" />
                </button>
              )}
              <span className="font-extrabold text-base tracking-tight text-slate-850 dark:text-neutral-100">
                {getToolTitle()}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-950/40 px-2.5 py-1 rounded-md font-semibold flex items-center gap-1">
                <Terminal className="h-3 w-3" />
                In-Browser Only
              </span>
            </div>
          </header>

          <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
            {renderActiveTool()}
          </main>
        </div>
      </div>
    </div>
  );
}
