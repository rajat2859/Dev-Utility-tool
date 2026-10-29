import React from 'react';
import { LayoutDashboard, FileImage, Paintbrush, Key, X, Menu, ShieldCheck, Wrench, FileCode, Search, MonitorSmartphone, Settings, Braces } from 'lucide-react';
import { prefetchTool } from '../App';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  isDrawerOpen: boolean;
  isNavigationReachable: boolean;
  onToggleDrawer: () => void;
  /** Tool views hide the permanent rail; it slides in on demand instead. */
  isToolView: boolean;
}

interface MenuItem {
  id: string;
  name: string;
  icon: React.ElementType;
}

const menuItems: MenuItem[] = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
  { id: 'seo-checker', name: 'SEO & Schema', icon: Search },
  { id: 'content-checker', name: 'Content Audit', icon: ShieldCheck },
  { id: 'responsive-preview', name: 'Responsive', icon: MonitorSmartphone },
  { id: 'schema-generator', name: 'Schema Gen', icon: Braces },
  { id: 'html-cleaner', name: 'HTML Cleaner', icon: FileCode },
  { id: 'image', name: 'Image Convert', icon: FileImage },
  { id: 'gradient', name: 'Gradient Studio', icon: Paintbrush },
  { id: 'password', name: 'Passwords', icon: Key },
];

const settingsItem: MenuItem = { id: 'settings', name: 'Settings', icon: Settings };

export default function Sidebar({
  currentView,
  onSelectView,
  isDrawerOpen,
  isNavigationReachable,
  onToggleDrawer,
  isToolView,
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
        className="pop-navbtn"
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
        <span className="md:hidden lg:inline truncate">{item.name}</span>
      </button>
    );
  };

  const Brand = (
    <>
      <div
        className="h-9 w-9 shrink-0 grid place-items-center border-[2.5px] border-ink rounded-tile bg-acc-blue text-white shadow-brut-2"
        aria-hidden="true"
      >
        <Wrench className="h-4 w-4" strokeWidth={2} />
      </div>
      <span className="hidden md:hidden lg:inline font-display font-bold uppercase tracking-[.08em] text-[12px] text-ink leading-tight">
        Utility
        <br />
        Studio
      </span>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="pop-chrome md:hidden fixed top-0 left-0 right-0 h-14 bg-paper border-b-[2.5px] border-ink px-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-2.5">
          {Brand}
          <span className="font-display font-bold uppercase tracking-[.08em] text-[13px] text-ink">Utility Studio</span>
        </div>
        <button
          onClick={onToggleDrawer}
          className="pop-iconbtn"
          aria-label="Toggle Navigation"
        >
          {isDrawerOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Floating hamburger: tool views hide the rail, slide it in on demand (desktop) */}
      {isToolView && (
        <button
          onClick={onToggleDrawer}
          className="pop-iconbtn fixed top-3 left-3 z-30 hidden! md:grid!"
          aria-label="Toggle Navigation"
          title="Toggle Navigation"
        >
          {isDrawerOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      )}

      {(isDrawerOpen && isToolView) && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={onToggleDrawer} />
      )}
      {(isDrawerOpen && !isToolView) && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onToggleDrawer} />
      )}

      {/* Sidebar rail */}
      <aside
        inert={!isNavigationReachable}
        aria-hidden={!isNavigationReachable}
        aria-label="Tools navigation"
        className={`pop-chrome fixed inset-y-0 left-0 w-64 md:w-[68px] lg:w-56 bg-paper border-r-[2.5px] border-ink flex flex-col z-50 transition-transform duration-200 ease-out motion-reduce:transition-none ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isToolView ? '' : 'md:translate-x-0'}`}
      >
        <div className="h-14 shrink-0 px-3.5 border-b-[2.5px] border-ink flex items-center gap-2.5">
          {Brand}
        </div>

        <nav className="flex-1 px-3 py-3.5 space-y-2 overflow-y-auto">
          {menuItems.map(renderMenuButton)}
        </nav>

        <div className="shrink-0 px-3 py-3.5 border-t-[2.5px] border-ink">
          {renderMenuButton(settingsItem)}
        </div>
      </aside>
    </>
  );
}
