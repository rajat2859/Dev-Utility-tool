import React, { useState, useEffect, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import DashboardGrid from './components/DashboardGrid';
import { ArrowLeft, Zap, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Lazy load tool components for optimal code-splitting and instant initial page loading
const ImageConverter = lazy(() => import('./components/tools/ImageConverter'));
const GradientGenerator = lazy(() => import('./components/tools/GradientGenerator'));
const PasswordGenerator = lazy(() => import('./components/tools/PasswordGenerator'));
const ContentChecker = lazy(() => import('./components/tools/ContentChecker'));
const HtmlCleaner = lazy(() => import('./components/tools/HtmlCleaner'));

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
      case 'html-cleaner':
        return 'HTML Cleaner & Sanitizer';
      case 'image':
        return 'Bulk Image Format Converter';
      case 'gradient':
        return 'Gradient Studio';
      case 'password':
        return 'Cryptographic Key & Password Generator';
      case 'content-checker':
        return 'SEO & Copy Content Auditor (Gemini AI)';
      default:
        return 'Utility Tool Manager Workspace';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 font-sans antialiased flex selection:bg-indigo-600 selection:text-white">
      <Sidebar
        currentView={activeView}
        onSelectView={setActiveView}
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
              <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="hidden sm:inline font-mono">Ultra Fast Runtime</span>
              <span className="sm:hidden font-mono text-[11px]">Fast</span>
            </span>
          </div>
        </header>

        <main className="flex-1 p-3.5 sm:p-6 md:p-8 max-w-7xl w-full mx-auto min-w-0">
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              <span className="text-xs font-semibold tracking-wide uppercase font-mono">Loading Tool...</span>
            </div>
          }>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
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
