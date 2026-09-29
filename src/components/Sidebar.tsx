import React from 'react';
import { LayoutDashboard, FileImage, Paintbrush, Key, X, Menu, ShieldCheck, Wrench, FileCode, Search, MonitorSmartphone, Settings } from 'lucide-react';
import { prefetchTool } from '../App';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  isDrawerOpen: boolean;
  isNavigationReachable: boolean;
  onToggleDrawer: () => void;
}

interface MenuItem {
  id: string;
  name: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
}

const menuItems: MenuItem[] = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
  { id: 'seo-checker', name: 'SEO & Schema', icon: Search, badge: 'AI', badgeColor: 'text-sky-300 bg-sky-950 border-sky-800' },
  { id: 'content-checker', name: 'Content Audit', icon: ShieldCheck, badge: 'AI', badgeColor: 'text-indigo-300 bg-indigo-950 border-indigo-800' },
  { id: 'responsive-preview', name: 'Responsive Preview', icon: MonitorSmartphone, badge: 'NEW', badgeColor: 'text-emerald-300 bg-emerald-950 border-emerald-800' },
  { id: 'html-cleaner', name: 'HTML Cleaner', icon: FileCode },
  { id: 'image', name: 'Image Converter', icon: FileImage },
  { id: 'gradient', name: 'Gradient Studio', icon: Paintbrush },
  { id: 'password', name: 'Password Generator', icon: Key },
];

const settingsItem: MenuItem = { id: 'settings', name: 'Settings', icon: Settings };

export default function Sidebar({
  currentView,
  onSelectView,
  isDrawerOpen,
  isNavigationReachable,
  onToggleDrawer,
}: SidebarProps) {
  const renderMenuButton = (item: MenuItem) => {
    const Icon = item.icon;
    const isActive = currentView === item.id;
    return (
      <button
        key={item.id}
        title={item.name}
        aria-label={item.name}
        aria-current={isActive ? 'page' : undefined}
        onMouseEnter={() => prefetchTool(item.id)}
        onFocus={() => prefetchTool(item.id)}
        onClick={() => {
          onSelectView(item.id);
          if (isDrawerOpen) onToggleDrawer();
        }}
        className={`w-full flex items-center justify-between md:justify-center gap-2.5 px-3 md:px-0 h-10 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
          isActive
            ? 'bg-blue-600 text-white font-semibold'
            : 'text-slate-400 hover:bg-slate-700 hover:text-white'
        }`}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="md:hidden truncate">{item.name}</span>
        </span>
        {item.badge && (
          <span className={`md:hidden text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md border tracking-wide ${
            isActive ? 'bg-white/20 text-white border-white/30' : item.badgeColor
          }`}>
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <Wrench className="h-3.5 w-3.5" />
          </div>
          <span className="font-bold text-sm tracking-tight text-slate-900">Utility Tool Manager</span>
        </div>
        <button
          onClick={onToggleDrawer}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors"
          aria-label="Toggle Navigation"
        >
          {isDrawerOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {isDrawerOpen && (
        <div className="fixed inset-0 bg-slate-950/40 z-40 md:hidden" onClick={onToggleDrawer} />
      )}

      <aside
        inert={!isNavigationReachable}
        aria-hidden={!isNavigationReachable}
        aria-label="Tools navigation"
        className={`fixed inset-y-0 left-0 w-64 md:w-14 bg-[#090d16] text-slate-100 border-r border-slate-800 flex flex-col z-50 transition-transform duration-200 ease-out motion-reduce:transition-none md:transition-none md:translate-x-0 ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-14 shrink-0 px-4 md:px-0 border-b border-slate-800 flex items-center gap-2.5 md:justify-center">
          <div className="h-9 w-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shrink-0">
            <Wrench className="h-4 w-4" />
          </div>
          <span className="md:hidden font-bold text-sm tracking-tight text-white truncate">Utility Tool Manager</span>
        </div>

        <nav className="flex-1 px-3 md:px-2 py-3 space-y-1 overflow-y-auto">
          {menuItems.map(renderMenuButton)}
        </nav>

        <div className="shrink-0 px-3 md:px-2 py-3 border-t border-slate-800">
          {renderMenuButton(settingsItem)}
        </div>
      </aside>
    </>
  );
}
