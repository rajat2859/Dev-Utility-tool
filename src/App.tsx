import React, { useState, useEffect, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import DashboardGrid from './components/DashboardGrid';

// Tool component imports with prefetching support
const toolsMap: Record<string, () => Promise<any>> = {
  'seo-checker': () => import('./components/tools/SeoChecker'),
  'html-cleaner': () => import('./components/tools/HtmlCleaner'),
  'image': () => import('./components/tools/ImageConverter'),
  'schema-generator': () => import('./components/tools/SchemaGenerator'),
  'gradient': () => import('./components/tools/GradientGenerator'),
  'password': () => import('./components/tools/PasswordGenerator'),
  'content-checker': () => import('./components/tools/ContentChecker'),
  'responsive-preview': () => import('./components/tools/ResponsivePreview'),
  'settings': () => import('./components/Settings'),
};

const ImageConverter = lazy(toolsMap['image']);
const SchemaGenerator = lazy(toolsMap['schema-generator']);
const GradientGenerator = lazy(toolsMap['gradient']);
const PasswordGenerator = lazy(toolsMap['password']);
const ContentChecker = lazy(toolsMap['content-checker']);
const ResponsivePreview = lazy(toolsMap['responsive-preview']);
const SeoChecker = lazy(toolsMap['seo-checker']);
const HtmlCleaner = lazy(toolsMap['html-cleaner']);
const Settings = lazy(toolsMap['settings']);

// Global prefetch helper for instant tool opening on hover
export const prefetchTool = (toolId: string) => {
  if (toolsMap[toolId]) {
    toolsMap[toolId]().catch(() => {});
  }
};

const DESKTOP_QUERY = '(min-width: 768px)';

export default function App() {
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
      if (event.matches) setIsDrawerOpen(false);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const toggleDrawer = () => setIsDrawerOpen((value) => !value);

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
      case 'schema-generator':
        return <SchemaGenerator />;
      case 'gradient':
        return <GradientGenerator />;
      case 'password':
        return <PasswordGenerator />;
      case 'content-checker':
        return <ContentChecker />;
      case 'responsive-preview':
        return <ResponsivePreview />;
      case 'settings':
        return <Settings />;
      default:
        return (
          <DashboardGrid 
            onSelectTool={(toolId) => {
              setActiveView(toolId);
              window.scrollTo({ top: 0 });
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
      case 'schema-generator':
        return 'Schema Markup Generator';
      case 'gradient':
        return 'CSS Gradient & Color Palette Studio';
      case 'password':
        return 'Cryptographic Password Generator';
      case 'content-checker':
        return 'Content & Schema Audit QA';
      case 'responsive-preview':
        return 'Responsive Multi-Device Preview';
      case 'settings':
        return 'Settings';
      default:
        return 'Developer & Web QA Utilities';
    }
  };

  // Keyboard navigation: Escape key returns to dashboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes the mobile drawer first so it doesn't also navigate away underneath it.
      if (e.key !== 'Escape') return;
      if (isDrawerOpen) {
        setIsDrawerOpen(false);
      } else if (activeView !== 'dashboard') {
        setActiveView('dashboard');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView, isDrawerOpen]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex selection:bg-blue-600 selection:text-white">
      <Sidebar
        currentView={activeView}
        onSelectView={(id) => {
          prefetchTool(id);
          setActiveView(id);
        }}
        isDrawerOpen={isDrawerOpen}
        isNavigationReachable={isDesktop || isDrawerOpen}
        onToggleDrawer={toggleDrawer}
      />

      <main className="flex-1 min-w-0 pt-14 md:pt-0 md:pl-14">
        <div className="p-4 md:p-5 w-full">
          <h1 className="sr-only">{getToolTitle()}</h1>
          <Suspense fallback={
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <div className="h-5 bg-slate-200 rounded-md w-1/4"></div>
                <div className="h-4 bg-slate-100 rounded-md w-1/2"></div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="h-10 bg-slate-100 rounded-lg w-full"></div>
                <div className="h-28 bg-slate-50 border border-slate-200 rounded-lg w-full"></div>
              </div>
            </div>
          }>
            <div key={activeView} className="view-enter">
              {renderActiveTool()}
            </div>
          </Suspense>
        </div>
      </main>
    </div>
  );
}
