import React from 'react';
import { LayoutDashboard, FileImage, Paintbrush, Key, X, Menu, ShieldCheck, Wrench, Zap, FileCode, Search, MonitorSmartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { prefetchTool } from '../App';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

interface MenuItem {
  id: string;
  name: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
}

export default function Sidebar({
  currentView,
  onSelectView,
  isOpen,
  onToggleOpen,
}: SidebarProps) {
  const menuItems: MenuItem[] = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'seo-checker', name: 'SEO & Schema', icon: Search },
    { id: 'content-checker', name: 'Content Audit', icon: ShieldCheck },
    { id: 'responsive-preview', name: 'Responsive Preview', icon: MonitorSmartphone },
    { id: 'html-cleaner', name: 'HTML Cleaner', icon: FileCode },
    { id: 'image', name: 'Image Converter', icon: FileImage },
    { id: 'gradient', name: 'Gradient Studio', icon: Paintbrush },
    { id: 'password', name: 'Password Generator', icon: Key },
  ];

  return (
    <>
      {/* Mobile top bar trigger */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold text-xs shadow-xs">
            <Wrench className="h-4 w-4" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-slate-900">Utility Tool Manager</span>
        </div>
        <button
          onClick={onToggleOpen}
          className="p-1.5 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
        >
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Sidebar background overlay for mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 bg-slate-950/25 backdrop-blur-xs z-40 md:hidden"
            onClick={onToggleOpen}
          />
        )}
      </AnimatePresence>

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-slate-900 text-slate-100 border-r border-slate-800 flex flex-col z-50 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="h-14 px-5 border-b border-slate-800 flex items-center gap-3 bg-slate-950/60">
          <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm relative overflow-hidden group">
            <Wrench className="h-4 w-4 text-white" />
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-semibold text-sm tracking-tight text-white block leading-tight truncate">
              Utility Tool Manager
            </span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide block">
              Developer Suite & AI Audit
            </span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2.5 block mb-2">
            Main Workspace
          </span>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onMouseEnter={() => prefetchTool(item.id)}
                onFocus={() => prefetchTool(item.id)}
                onClick={() => {
                  onSelectView(item.id);
                  if (isOpen) onToggleOpen();
                }}
                className={`relative w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer group ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeSidebarPill"
                    className="absolute inset-0 bg-blue-600 rounded-lg shadow-sm"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <div className="relative z-10 flex items-center gap-2.5 min-w-0">
                  <Icon className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.name}</span>
                </div>

                {item.badge && (
                  <span className={`relative z-10 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                    isActive ? 'bg-blue-800 text-blue-100 border border-blue-700' : 'bg-slate-800 text-blue-300'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer actions */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60">
          <div className="px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/80 text-[11px] text-slate-300 font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>Native Runtime Engine</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 font-semibold bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
              Active
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
