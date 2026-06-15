import React from 'react';
import { LayoutDashboard, FileImage, Sun, Moon, Terminal, X, Menu } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  favorites: string[];
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export default function Sidebar({
  currentView,
  onSelectView,
  theme,
  onToggleTheme,
  isOpen,
  onToggleOpen,
}: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'image', name: 'Image Converter', icon: FileImage },
  ];

  return (
    <>
      {/* Mobile top bar trigger */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-elegant-bg border-b border-slate-200 dark:border-elegant-border px-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-extrabold text-sm shadow-md">
            U
          </div>
          <span className="font-extrabold text-sm tracking-tight text-slate-850 dark:text-neutral-100">Utility Hub</span>
        </div>
        <button
          onClick={onToggleOpen}
          className="p-2 rounded-lg border border-slate-200 dark:border-elegant-border text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-elegant-card-hover cursor-pointer"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Sidebar background overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden"
          onClick={onToggleOpen}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-white dark:bg-elegant-bg border-r border-slate-200/80 dark:border-elegant-border flex flex-col z-50 transition-transform duration-300 transform md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="h-16 px-6 border-b border-slate-200/80 dark:border-elegant-border flex items-center gap-3">
          <div className="h-9 w-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-md shadow-indigo-600/30">
            U
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-neutral-100 block">Utility Hub</span>
            <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider block">Development suite</span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 block mb-2">
            Navigation
          </span>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectView(item.id);
                  if (isOpen) onToggleOpen();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-elegant-card-hover hover:text-slate-900 dark:hover:text-neutral-100 border border-transparent'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-200/85 dark:border-elegant-border space-y-3">
          <button
            onClick={onToggleTheme}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-200/80 dark:border-elegant-border text-sm font-medium text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-elegant-card-hover cursor-pointer transition-colors"
          >
            <span className="flex items-center gap-2.5">
              {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-indigo-600" />}
              <span>Theme Preference</span>
            </span>
            <span className="text-[10px] font-bold uppercase text-slate-400 font-mono">
              {theme}
            </span>
          </button>

          <div className="px-3 py-2 rounded-xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-150 dark:border-elegant-border/50 text-[10px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            <span>Pure Browser Runtime</span>
          </div>
        </div>
      </aside>
    </>
  );
}
