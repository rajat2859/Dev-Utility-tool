import React from 'react';
import { LayoutDashboard, Star, MessageSquareCode, ShieldCheck, Binary, Clock, Type, Palette, Compass, Menu, X, Sun, Moon, Image } from 'lucide-react';
import { ToolCategory } from '../types';

interface SidebarProps {
  currentView: string;
  onSelectView: (viewId: string) => void;
  favorites: string[];
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export default function Sidebar({
  currentView,
  onSelectView,
  favorites,
  theme,
  onToggleTheme,
  isOpen,
  onToggleOpen,
}: SidebarProps) {
  const toolsMenu = [
    { id: 'json', name: 'JSON Formatter', cat: 'development', icon: MessageSquareCode },
    { id: 'encoding', name: 'Base64 & Hash', cat: 'encoding', icon: ShieldCheck },
    { id: 'generator', name: 'Generators', cat: 'generators', icon: Binary },
    { id: 'timestamp', name: 'Epoch Conv', cat: 'converters', icon: Clock },
    { id: 'text', name: 'Text Metrics', cat: 'development', icon: Type },
    { id: 'color', name: 'Color Checker', cat: 'design', icon: Palette },
    { id: 'image', name: 'Image Converter', cat: 'converters', icon: Image },
  ];

  const favoriteTools = toolsMenu.filter(t => favorites.includes(t.id));

  return (
    <>
      <button
        onClick={onToggleOpen}
        className="fixed top-4 left-4 z-50 md:hidden p-2.5 rounded-xl bg-white border border-slate-200 dark:bg-elegant-card dark:border-elegant-border text-slate-800 dark:text-slate-100 shadow-md cursor-pointer"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200/80 dark:border-elegant-border bg-white dark:bg-elegant-sidebar flex flex-col justify-between transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="space-y-6 flex-1 px-4 py-6 md:py-8 overflow-y-auto">
          <div className="flex items-center gap-2.5 px-2">
            <div className="h-9 w-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md shadow-indigo-600/30">
              U
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">Utility Hub</span>
              <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">Suite Manager</span>
            </div>
          </div>

          <div className="space-y-1.5 pt-4">
            <button
              onClick={() => { onSelectView('dashboard'); onToggleOpen(); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                currentView === 'dashboard'
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-elegant-card-hover hover:text-slate-900 dark:hover:text-neutral-100'
              }`}
            >
              <LayoutDashboard className="h-4.5 w-4.5" />
              <span>Dashboard Overview</span>
            </button>
          </div>

          {favoriteTools.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-widest px-2.5 flex items-center gap-1.5">
                <Star className="h-3 w-3 fill-amber-500" />
                Favorites / Pinned
              </span>
              <div className="space-y-1">
                {favoriteTools.map(f => {
                  const Icon = f.icon;
                  return (
                    <button
                      key={f.id}
                      onClick={() => { onSelectView(f.id); onToggleOpen(); }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                        currentView === f.id
                          ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-elegant-card-hover hover:text-slate-900 dark:hover:text-neutral-100'
                      }`}
                    >
                      <Icon className="h-4.5 w-4.5 text-amber-500" />
                      <span className="truncate">{f.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2.5 flex items-center gap-1.5">
              <Compass className="h-3 w-3 text-slate-400" />
              Core Utility Fleet
            </span>
            <div className="space-y-1">
              {toolsMenu.map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => { onSelectView(t.id); onToggleOpen(); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                      currentView === t.id
                        ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-elegant-card-hover hover:text-slate-900 dark:hover:text-neutral-100'
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5 text-slate-450 dark:text-slate-500" />
                    <span className="truncate">{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200/80 dark:border-elegant-border space-y-3.5">
          <div className="bg-slate-50 dark:bg-elegant-bg p-3 rounded-xl border border-slate-100 dark:border-elegant-border flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-650 dark:text-slate-400">
              {theme === 'dark' ? 'Dark Visuals' : 'Light Visuals'}
            </span>
            <button
              onClick={onToggleTheme}
              className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 dark:bg-elegant-sidebar dark:border-elegant-border text-slate-700 dark:text-slate-350 cursor-pointer shadow-xs transition-colors"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-500 animate-spin-slow" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-600" />
              )}
            </button>
          </div>
          <span className="text-[10px] text-slate-400 font-medium block text-center leading-relaxed">
            All processing executes entirely in-browser. No payload ever leaves your device.
          </span>
        </div>
      </div>
      
      {isOpen && (
        <div
          onClick={onToggleOpen}
          className="fixed inset-0 z-30 bg-black/20 dark:bg-black/40 backdrop-blur-xs md:hidden"
        />
      )}
    </>
  );
}
