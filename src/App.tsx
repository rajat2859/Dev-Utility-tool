import React, { useState, useEffect, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import DashboardGrid from './components/DashboardGrid';
import { ArrowLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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

const SIDEBAR_STORAGE_KEY = 'util_hub_sidebar_collapsed';
const DESKTOP_QUERY = '(min-width: 768px)';

export default function App() {
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [favorites, setFavorites] = useState<string[]>([]);
  // Two independent things: the mobile drawer (transient) and the desktop
  // collapse (sticky, remembered). One button drives whichever applies.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);

  // The breakpoint decides which toggle the button drives and whether the
  // off-screen sidebar should still be reachable by Tab, so JS has to know it
  // too - CSS variants alone can't answer that.
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
      // Otherwise a drawer left open on a narrow window reappears the next time
      // the viewport drops back below the breakpoint.
      if (event.matches) setSidebarOpen(false);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const toggleSidebar = () => {
    if (!isDesktop) {
      setSidebarOpen((value) => !value);
      return;
    }
    setSidebarCollapsed((value) => {
      const next = !value;
      try { localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0'); } catch { /* no-op */ }
      return next;
    });
  };

  const sidebarVisible = isDesktop ? !sidebarCollapsed : sidebarOpen;

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
      ? 'Utility Tool Manager | Developer & Web QA Toolkit' 
      : `${getToolTitle()} | Utility Tool Manager`;
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
            onSelectTool={(toolId) => {
              setActiveView(toolId);
              window.scrollTo({ top: 0, behavior: 'smooth' });
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
        return 'SEO & Schema Validator';
      case 'html-cleaner':
        return 'HTML Cleaner & Markdown Converter';
      case 'image':
        return 'Image Format Converter';
      case 'gradient':
        return 'CSS Gradient & Color Palette Studio';
      case 'password':
        return 'Cryptographic Password Generator';
      case 'content-checker':
        return 'Content & Schema Audit QA';
      case 'responsive-preview':
        return 'Responsive Multi-Device Preview';
      default:
        return 'Developer & Web QA Utilities';
    }
  };

  // Keyboard navigation: Escape key returns to dashboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // No modifier shortcut for the sidebar: Ctrl/Cmd+B belongs to Bold in the
      // HTML Cleaner's visual editor. Escape closes the mobile drawer first so
      // it doesn't also navigate away underneath it.
      if (e.key !== 'Escape') return;
      if (sidebarOpen) {
        setSidebarOpen(false);
      } else if (activeView !== 'dashboard') {
        setActiveView('dashboard');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView, sidebarOpen]);

  return (
    <div className="min-h-screen bg-canvas-pattern text-slate-900 font-sans antialiased flex selection:bg-blue-600 selection:text-white">
      <Sidebar
        currentView={activeView}
        onSelectView={(id) => {
          prefetchTool(id);
          setActiveView(id);
        }}
        isOpen={sidebarOpen}
        collapsed={sidebarCollapsed}
        visible={sidebarVisible}
        onToggleOpen={toggleSidebar}
      />

      <div
        className={`flex-1 flex flex-col min-w-0 pt-14 md:pt-0 transition-[padding-left] duration-200 ease-out motion-reduce:transition-none ${
          sidebarCollapsed ? 'md:pl-0' : 'md:pl-64'
        }`}
      >
        <header className="sticky top-14 md:top-0 z-20 h-14 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 px-4 sm:px-6 md:px-8 flex items-center justify-between shadow-2xs min-w-0 transition-all">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={toggleSidebar}
              className="hidden md:inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200/90 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-950 cursor-pointer transition-colors shadow-2xs shrink-0"
              title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
              aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
              aria-expanded={!sidebarCollapsed}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
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
