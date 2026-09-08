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
  'responsive-preview': () => import('./components/tools/ResponsivePreview'),
};

const ImageConverter = lazy(toolsMap['image']);
const GradientGenerator = lazy(toolsMap['gradient']);
const PasswordGenerator = lazy(toolsMap['password']);
const ContentChecker = lazy(toolsMap['content-checker']);
const ResponsivePreview = lazy(toolsMap['responsive-preview']);
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
      case 'responsive-preview':
        return <ResponsivePreview />;
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
      case 'responsive-preview':
        return 'Responsive Device Preview';
      default:
        return 'Utility Tool Manager Workspace';
    }
  };

  // Keyboard navigation: Escape key returns to dashboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeView !== 'dashboard') {
        setActiveView('dashboard');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView]);

  return (
    <div className="min-h-screen bg-canvas-pattern text-slate-900 font-sans antialiased flex selection:bg-blue-600 selection:text-white">
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
        <header className="sticky top-14 md:top-0 z-20 h-14 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 px-4 sm:px-6 md:px-8 flex items-center justify-between shadow-2xs min-w-0 transition-all">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {activeView !== 'dashboard' && (
              <motion.button
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05, x: -2 }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.12 }}
                onClick={() => setActiveView('dashboard')}
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200/90 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950 cursor-pointer transition-colors shadow-2xs shrink-0"
                title="Return to Dashboard (Esc)"
              >
                <ArrowLeft className="h-4 w-4" />
              </motion.button>
            )}
            <div className="flex items-center gap-2 min-w-0 text-xs">
              <button
                onClick={() => setActiveView('dashboard')}
                className="font-semibold text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-wider shrink-0 cursor-pointer"
              >
                Workspace
              </button>
              {activeView !== 'dashboard' && (
                <>
                  <span className="text-slate-300 shrink-0">/</span>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50/80 border border-blue-200/60 min-w-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0 animate-pulse" />
                    <h1 className="font-bold text-xs sm:text-sm tracking-tight text-blue-900 truncate">
                      {getToolTitle()}
                    </h1>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="inline-flex text-xs bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800 border border-blue-200/90 px-2.5 py-1 rounded-full font-semibold items-center gap-1.5 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-mono text-[11px] sm:text-xs">Fast Engine · Active</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto min-w-0">
          <Suspense fallback={
            <div className="space-y-6 animate-pulse">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-3">
                <div className="h-5 bg-slate-200 rounded-md w-1/4"></div>
                <div className="h-4 bg-slate-100 rounded-md w-1/2"></div>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4">
                <div className="h-10 bg-slate-100 rounded-xl w-full"></div>
                <div className="h-28 bg-slate-50 border border-slate-200/80 rounded-xl w-full"></div>
              </div>
            </div>
          }>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                className="gpu-layer"
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
