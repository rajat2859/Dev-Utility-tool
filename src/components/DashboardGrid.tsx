import React, { useState } from 'react';
import {
  FileImage, Paintbrush, Key, Heart, Wrench,
  ShieldCheck, FileCode, MonitorSmartphone, Braces, Search, ArrowUpRight
} from 'lucide-react';
import { prefetchTool } from '../App';
import { cn } from '../lib/utils';
import ThemeToggle from './ThemeToggle';

type CategoryId = 'all' | 'developer' | 'text' | 'web' | 'time' | 'design' | 'security';

const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'developer', label: 'Developer' },
  { id: 'text', label: 'Text' },
  { id: 'web', label: 'Web' },
  { id: 'time', label: 'Time' },
  { id: 'design', label: 'Design' },
  { id: 'security', label: 'Security' },
];

interface ToolDef {
  id: string;
  name: string;
  category: Exclude<CategoryId, 'all' | 'time'>;
  icon: React.ElementType;
  iconClass: string;
  /** Accent color used for the card's hover state, matched to its icon tint. */
  hover: string;
}

const tools: ToolDef[] = [
  {
    id: 'seo-checker',
    name: 'SEO & Schema Validator',
    category: 'web',
    icon: Search,
    iconClass: 'text-blue-600 bg-blue-50',
    hover: 'hover:border-blue-300 hover:bg-blue-50/50',
  },
  {
    id: 'responsive-preview',
    name: 'Responsive Preview',
    category: 'web',
    icon: MonitorSmartphone,
    iconClass: 'text-emerald-600 bg-emerald-50',
    hover: 'hover:border-emerald-300 hover:bg-emerald-50/50',
  },
  {
    id: 'content-checker',
    name: 'Content Audit',
    category: 'web',
    icon: ShieldCheck,
    iconClass: 'text-indigo-600 bg-indigo-50',
    hover: 'hover:border-indigo-300 hover:bg-indigo-50/50',
  },
  {
    id: 'schema-generator',
    name: 'Schema Generator',
    category: 'developer',
    icon: Braces,
    iconClass: 'text-sky-600 bg-sky-50',
    hover: 'hover:border-sky-300 hover:bg-sky-50/50',
  },
  {
    id: 'html-cleaner',
    name: 'HTML Cleaner',
    category: 'text',
    icon: FileCode,
    iconClass: 'text-cyan-600 bg-cyan-50',
    hover: 'hover:border-cyan-300 hover:bg-cyan-50/50',
  },
  {
    id: 'image',
    name: 'Image Converter',
    category: 'design',
    icon: FileImage,
    iconClass: 'text-purple-600 bg-purple-50',
    hover: 'hover:border-purple-300 hover:bg-purple-50/50',
  },
  {
    id: 'gradient',
    name: 'Gradient Studio',
    category: 'design',
    icon: Paintbrush,
    iconClass: 'text-rose-600 bg-rose-50',
    hover: 'hover:border-rose-300 hover:bg-rose-50/50',
  },
  {
    id: 'password',
    name: 'Password Generator',
    category: 'security',
    icon: Key,
    iconClass: 'text-amber-600 bg-amber-50',
    hover: 'hover:border-amber-300 hover:bg-amber-50/50',
  },
];

const categoryLabels: Record<CategoryId, string> = Object.fromEntries(
  CATEGORIES.map(({ id, label }) => [id, label]),
) as Record<CategoryId, string>;

const categoryCounts: Record<CategoryId, number> = CATEGORIES.reduce(
  (acc, { id }) => ({
    ...acc,
    [id]: id === 'all' ? tools.length : tools.filter((t) => t.category === id).length,
  }),
  {} as Record<CategoryId, number>,
);

interface DashboardGridProps {
  onSelectTool: (toolId: string) => void;
  favorites: string[];
  onToggleFavorite: (toolId: string, event: React.MouseEvent) => void;
}

export default function DashboardGrid({
  onSelectTool,
  favorites,
  onToggleFavorite,
}: DashboardGridProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all');

  const visibleTools =
    activeCategory === 'all'
      ? [
          ...tools.filter((tool) => favorites.includes(tool.id)),
          ...tools.filter((tool) => !favorites.includes(tool.id)),
        ]
      : tools.filter((tool) => tool.category === activeCategory);

  return (
    <div className="dash-bg -mx-4 -my-4 md:-mx-5 md:-my-5 flex flex-col min-h-[calc(100vh-3.5rem)] md:min-h-screen px-4 py-4 md:px-5 md:py-6">
      {/* Dashboard container */}
      <div className="dashboard-panel rounded-2xl border border-slate-200 bg-white shadow-2xs flex flex-col min-h-[calc(100vh-5.5rem)] md:min-h-[calc(100vh-6.5rem)]">
          <header className="flex items-center justify-between gap-4 px-4 md:px-6 py-5 border-b border-slate-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-2xs">
                <Wrench className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold tracking-tight text-slate-900 leading-tight truncate">
                  Utility Studio
                </h2>
                <p className="text-xs text-slate-500 truncate">Small utilities. Faster workflows.</p>
              </div>
            </div>
            <ThemeToggle />
          </header>

          <div className="p-4 md:p-6 space-y-5 flex-1 flex flex-col">
            <div
              role="group"
              aria-label="Filter tools by category"
              className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 md:flex-wrap md:overflow-visible"
            >
              {CATEGORIES.map((category) => {
                const isActive = activeCategory === category.id;
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    aria-pressed={isActive}
                    className={cn(
                      'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors',
                      'outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                      isActive
                        ? 'bg-blue-600 text-white border border-blue-600 shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900',
                    )}
                  >
                    {category.label}
                    <span
                      className={cn(
                        'text-[10px] font-mono font-bold tabular-nums',
                        isActive ? 'text-white/70' : 'text-slate-400',
                      )}
                    >
                      {categoryCounts[category.id]}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {visibleTools.map((tool) => {
                const Icon = tool.icon;
                const isPinned = favorites.includes(tool.id);
                return (
                  <div
                    key={tool.id}
                    role="button"
                    tabIndex={0}
                    aria-label={tool.name}
                    onMouseEnter={() => prefetchTool(tool.id)}
                    onFocus={() => prefetchTool(tool.id)}
                    onClick={() => onSelectTool(tool.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectTool(tool.id);
                      }
                    }}
                    className={cn(
                      'group flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 cursor-pointer outline-none',
                      'transition-[border-color,background-color,box-shadow,transform] duration-150 hover:shadow-2xs motion-reduce:transition-none',
                      'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500',
                      tool.hover,
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className={cn('h-8 w-8 rounded-md flex items-center justify-center', tool.iconClass)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={(e) => onToggleFavorite(tool.id, e)}
                          className={cn(
                            'p-1.5 -m-1 rounded-md transition-colors cursor-pointer shrink-0',
                            isPinned
                              ? 'text-rose-500 hover:text-rose-600'
                              : 'text-slate-300 hover:text-rose-500',
                          )}
                          title={isPinned ? 'Remove from Favorites' : 'Mark as Favorite'}
                          aria-label={isPinned ? `${tool.name}: remove from Favorites` : `${tool.name}: mark as Favorite`}
                        >
                          <Heart className={cn('h-3.5 w-3.5 group-hover:scale-110 motion-reduce:group-hover:scale-100 transition-transform', isPinned && 'fill-rose-500')} />
                        </button>
                        <ArrowUpRight
                          className={cn(
                            'h-4 w-4 text-slate-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:-translate-y-0 shrink-0',
                          )}
                          aria-hidden="true"
                        />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">{tool.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{categoryLabels[tool.category]}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {visibleTools.length === 0 && (
              <div className="py-14 text-center bg-slate-50 border border-dashed border-slate-300 rounded-lg space-y-1">
                <h4 className="font-semibold text-sm text-slate-900">Nothing here yet</h4>
                <p className="text-xs text-slate-500">No tools in the {categoryLabels[activeCategory]} category.</p>
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
