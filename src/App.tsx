import React, { useState, useEffect, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import DashboardGrid from './components/DashboardGrid';
import { ArrowLeft, Zap, Wrench, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Tool component imports with prefetching support
const toolsMap: Record<string, () => Promise<any>> = {
  'seo-checker': () => import('./components/tools/SeoChecker'),
  'html-cleaner': () => import('./components/tools/HtmlCleaner'),
  'image': () => import('./components/tools/ImageConverter'),
  'gradient': () => import('./components/tools/GradientGenerator'),
  'password': () => import('./components/tools/PasswordGenerator'),
  'content-checker': () => import('./components/tools/ContentChecker'),
};

const ImageConverter = lazy(toolsMap['image']);
const GradientGenerator = lazy(toolsMap['gradient']);
const PasswordGenerator = lazy(toolsMap['password']);
const ContentChecker = lazy(toolsMap['content-checker']);
const SeoChecker = lazy(toolsMap['seo-checker']);
const HtmlCleaner = lazy(toolsMap['html-cleaner']);

// Global prefetch helper for instant tool opening on hover
export const prefetchTool = (toolId: string) => {
  if (toolsMap[toolId]) {
    toolsMap[toolId]().catch(() => {});
  }
};

export default function App() {
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const savedFavs = localStorage.getItem('util_hub_favorites');
    if (savedFavs) {
      try {
        setFavorites(JSON.parse(savedFavs));
      } catch {
        // Fallback
      }
    }
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('util_hub_theme');

    // Idle background prefetching of all tool bundles for instantaneous navigation
    const timer = setTimeout(() => {
      Object.values(toolsMap).forEach(fn => fn().catch(() => {}));
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const title = activeView === 'dashboard' 
      ? 'Utility Tool Manager' 
      : `${getToolTitle()} - Utility Tool Manager`;
    document.title = title;
  }, [activeView]);

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
      case 'seo-checker':
        return <SeoChecker />;
      case 'html-cleaner':
        return <HtmlCleaner />;
      case 'image':
        return <ImageConverter />;
      case 'gradient':
        return <GradientGenerator />;
      case 'password':
        return <PasswordGenerator />;
      case 'content-checker':
        return <ContentChecker />;
      default:
        return (
          <DashboardGrid
            onSelectTool={(id) => {
              prefetchTool(id);
              setActiveView(id);
            }}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
          />
        );
    }
  };

  const getToolTitle = () => {
    switch (activeView) {
      case 'seo-checker':
        return 'SEO & Schema';
      case 'html-cleaner':
        return 'HTML Cleaner & Sanitizer';
      case 'image':
        return 'Bulk Image Format Converter';
      case 'gradient':
        return 'Gradient Studio';
      case 'password':
        return 'Cryptographic Key & Password Generator';
      case 'content-checker':
        return 'Content Audit';
      default:
        return 'Utility Tool Manager Workspace';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 font-sans antialiased flex selection:bg-indigo-600 selection:text-white">
      <Sidebar
        currentView={activeView}
        onSelectView={(id) => {
          prefetchTool(id);
          setActiveView(id);
        }}
        isOpen={sidebarOpen}
        onToggleOpen={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex-1 md:pl-64 flex flex-col min-w-0 pt-14 md:pt-0">
        <header className="sticky top-14 md:top-0 z-20 h-14 bg-white/90 backdrop-blur-md border-b border-slate-200/90 px-3 sm:px-6 md:px-8 flex items-center justify-between shadow-2xs min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {activeView !== 'dashboard' && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveView('dashboard')}
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-950 cursor-pointer transition-colors shadow-2xs shrink-0"
                title="Return to Dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
              </motion.button>
            )}
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-slate-400 hidden sm:inline uppercase tracking-wider shrink-0">Utility Tool Manager</span>
              {activeView !== 'dashboard' && <span className="text-slate-300 hidden sm:inline shrink-0">/</span>}
              <h1 className="font-bold text-xs sm:text-sm tracking-tight text-slate-900 truncate">
                {getToolTitle()}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex text-xs bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-2 sm:px-2.5 py-1 rounded-md font-semibold items-center gap-1.5 shadow-2xs">
              <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0 animate-pulse" />
              <span className="hidden sm:inline font-mono">Instant Turbo Engine</span>
              <span className="sm:hidden font-mono text-[11px]">Turbo</span>
            </span>
          </div>
        </header>

        <main className="flex-1 p-3.5 sm:p-6 md:p-8 max-w-7xl w-full mx-auto min-w-0">
          <Suspense fallback={
            <div className="space-y-6 animate-pulse">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-3">
                <div className="h-5 bg-slate-200 rounded-md w-1/4"></div>
                <div className="h-4 bg-slate-100 rounded-md w-1/2"></div>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
                <div className="h-10 bg-slate-100 rounded-xl w-full"></div>
                <div className="h-28 bg-slate-50 border border-slate-200 rounded-xl w-full"></div>
              </div>
            </div>
          }>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.1, ease: 'easeOut' }}
              >
                {renderActiveTool()}
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
