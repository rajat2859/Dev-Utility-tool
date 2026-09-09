import React from 'react';
import { LayoutDashboard, FileImage, Paintbrush, Key, X, Menu, PanelLeftClose, ShieldCheck, Wrench, Zap, FileCode, Search, MonitorSmartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { prefetchTool } from '../App';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  /** Mobile drawer state. */
  isOpen: boolean;
  /** Desktop collapse state, remembered across sessions. */
  collapsed: boolean;
  /** Whether the panel is actually on screen at the current breakpoint. */
  visible: boolean;
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
  collapsed,
  visible,
  onToggleOpen,
}: SidebarProps) {
  const menuItems: MenuItem[] = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'seo-checker', name: 'SEO & Schema', icon: Search, badge: 'AI', badgeColor: 'text-sky-300 bg-sky-950/80 border-sky-800/80' },
    { id: 'content-checker', name: 'Content Audit', icon: ShieldCheck, badge: 'AI', badgeColor: 'text-indigo-300 bg-indigo-950/80 border-indigo-800/80' },
    { id: 'responsive-preview', name: 'Responsive Preview', icon: MonitorSmartphone, badge: 'NEW', badgeColor: 'text-emerald-300 bg-emerald-950/80 border-emerald-800/80' },
    { id: 'html-cleaner', name: 'HTML Cleaner', icon: FileCode },
    { id: 'image', name: 'Image Converter', icon: FileImage },
    { id: 'gradient', name: 'Gradient Studio', icon: Paintbrush },
    { id: 'password', name: 'Password Generator', icon: Key },
  ];

  return (
    <>
      {/* Mobile top bar trigger */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white/90 backdrop-blur-xl border-b border-slate-200/90 px-4 flex items-center justify-between z-30 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-xs">
            <Wrench className="h-3.5 w-3.5" />
          </div>
          <span className="font-bold text-sm tracking-tight text-slate-900">Utility Tool Manager</span>
        </div>
        <button
          onClick={onToggleOpen}
          className="p-1.5 rounded-lg border border-slate-200/80 text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
          aria-label="Toggle Navigation"
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
            transition={{ duration: 0.14 }}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-40 md:hidden"
            onClick={onToggleOpen}
          />
        )}
      </AnimatePresence>

      {/* Sidebar container */}
      <aside
        inert={!visible}
        aria-hidden={!visible}
        aria-label="Tools navigation"
        className={`fixed inset-y-0 left-0 w-64 bg-[#090d16] text-slate-100 border-r border-slate-800/70 flex flex-col z-50 will-change-transform transition-transform duration-200 ease-out motion-reduce:transition-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'md:-translate-x-full' : 'md:translate-x-0'}`}
      >
        {/* Header Branding */}
        <div className="h-16 px-4 border-b border-slate-800/70 flex items-center gap-2.5 bg-slate-950/40">
          <div className="relative">
            <div className="h-9 w-9 bg-gradient-to-tr from-blue-600 via-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/20 ring-1 ring-white/20">
              <Wrench className="h-4 w-4 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500 ring-2 ring-[#090d16]"></span>
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-bold text-sm tracking-tight text-white block leading-tight truncate">
              Utility Tool Manager
            </span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide block truncate">
              Developer Precision Suite
            </span>
          </div>
          <button
            onClick={onToggleOpen}
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-slate-800/70 hover:text-white cursor-pointer transition-colors"
            title="Hide sidebar"
            aria-label="Hide sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-2.5 pb-2 flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Tools & Views</span>
            <span className="text-[10px] font-mono text-slate-500 lowercase">{menuItems.length - 1} tools</span>
          </div>

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
                className={`relative w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer group ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 hover:translate-x-0.5'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeSidebarPill"
                    className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 rounded-xl shadow-md shadow-blue-600/25 ring-1 ring-white/15"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
                <div className="relative z-10 flex items-center gap-2.5 min-w-0">
                  <Icon className={`h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'}`} />
                  <span className="truncate">{item.name}</span>
                </div>

                {item.badge && (
                  <span className={`relative z-10 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md border tracking-wide transition-colors ${
                    isActive ? 'bg-white/20 text-white border-white/30' : item.badgeColor || 'bg-slate-800 text-blue-300 border-slate-700'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer actions */}
        <div className="p-3 border-t border-slate-800/70 bg-slate-950/40">
          <div className="px-3 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90 text-[11px] text-slate-300 font-medium flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0 animate-pulse" />
              <span className="font-sans font-medium text-slate-300">Fast Local Runtime</span>
            </div>
            <span className="text-[9px] font-mono text-emerald-400 font-semibold bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/80 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Ready
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
