import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DashboardGrid from './components/DashboardGrid';
import ImageConverter from './components/tools/ImageConverter';
import GradientGenerator from './components/tools/GradientGenerator';
import PasswordGenerator from './components/tools/PasswordGenerator';
import ContentChecker from './components/tools/ContentChecker';
import { ArrowLeft, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
        favorites={favorites}
        isOpen={sidebarOpen}
        onToggleOpen={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex-1 md:pl-64 flex flex-col min-w-0 pt-14 md:pt-0">
        <header className="sticky top-0 z-20 h-14 bg-white/90 backdrop-blur-md border-b border-slate-200/90 px-6 md:px-8 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            {activeView !== 'dashboard' && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveView('dashboard')}
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-950 cursor-pointer transition-colors shadow-2xs"
                title="Return to Dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
              </motion.button>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 hidden sm:inline uppercase tracking-wider">Utility Tool Manager</span>
              {activeView !== 'dashboard' && <span className="text-slate-300 hidden sm:inline">/</span>}
              <h1 className="font-bold text-sm tracking-tight text-slate-900">
                {getToolTitle()}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex text-xs bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-2.5 py-1 rounded-md font-semibold items-center gap-1.5 shadow-2xs">
              <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="hidden sm:inline font-mono">Ultra Fast Runtime</span>
              <span className="sm:hidden font-mono">Fast</span>
            </span>
          </div>
        </header>

        <main className="flex-1 p-5 md:p-8 max-w-7xl w-full mx-auto">
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
        </main>
      </div>
    </div>
  );
}
