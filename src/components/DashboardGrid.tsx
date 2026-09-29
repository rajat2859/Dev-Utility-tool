import React, { useState, useRef, useEffect } from 'react';
import {
  FileImage, Paintbrush, Key, ArrowRight, Heart,
  Search, ShieldCheck, FileCode, MonitorSmartphone
} from 'lucide-react';
import { prefetchTool } from '../App';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Press '/' anywhere to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement !== searchInputRef.current &&
        (e.target as HTMLElement)?.tagName !== 'INPUT' &&
        (e.target as HTMLElement)?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const tools = [
    {
      id: 'seo-checker',
      name: 'SEO & Schema',
      description: 'Audit webpage meta title lengths, descriptions, Google SERP snippet previews, Open Graph tags, and Schema.org structured data validity.',
      category: 'AI & Quality Assurance',
      icon: Search,
      badge: 'SEO Inspector',
      badgeStyle: 'bg-blue-50 text-blue-700 border-blue-200/80',
      iconBg: 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20',
      hoverBorder: 'hover:border-blue-400/80',
      accentColor: 'group-hover:text-blue-600',
      stats: 'SEO & Schemas'
    },
    {
      id: 'content-checker',
      name: 'Content Audit',
      description: 'AI-powered visual copy and screenshot compliance auditor. Compares live webpage copy against reference Awesome Screenshot designs.',
      category: 'AI & Quality Assurance',
      icon: ShieldCheck,
      badge: 'Visual AI',
      badgeStyle: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
      iconBg: 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-md shadow-indigo-500/20',
      hoverBorder: 'hover:border-indigo-400/80',
      accentColor: 'group-hover:text-indigo-600',
      stats: 'Visual QA'
    },
    {
      id: 'responsive-preview',
      name: 'Responsive Preview',
      description: 'Preview websites across mobile, tablet, laptop, desktop, and custom viewports simultaneously with interactive horizontal overflow inspection.',
      category: 'AI & Quality Assurance',
      icon: MonitorSmartphone,
      badge: 'Device Lab',
      badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-md shadow-emerald-500/20',
      hoverBorder: 'hover:border-emerald-400/80',
      accentColor: 'group-hover:text-emerald-600',
      stats: 'Multi-Device'
    },
    {
      id: 'html-cleaner',
      name: 'HTML Cleaner & Sanitizer',
      description: 'Strip dirty inline styles, tracking scripts, Word document bloat, and broken tags instantly with custom sanitizer rules and live previews.',
      category: 'Design & Assets',
      icon: FileCode,
      badge: 'Sanitizer',
      badgeStyle: 'bg-cyan-50 text-cyan-700 border-cyan-200/80',
      iconBg: 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20',
      hoverBorder: 'hover:border-cyan-400/80',
      accentColor: 'group-hover:text-cyan-600',
      stats: '100% Offline'
    },
    {
      id: 'image',
      name: 'Bulk Image Converter',
      description: 'Render and batch-convert local image files into WebP, AVIF, transparent PNG, JPEG or SVG vector tracings with real-time size forecasting.',
      category: 'Design & Assets',
      icon: FileImage,
      badge: 'High Speed',
      badgeStyle: 'bg-purple-50 text-purple-700 border-purple-200/80',
      iconBg: 'bg-gradient-to-br from-purple-600 to-fuchsia-700 text-white shadow-md shadow-purple-500/20',
      hoverBorder: 'hover:border-purple-400/80',
      accentColor: 'group-hover:text-purple-600',
      stats: '100% Offline'
    },
    {
      id: 'gradient',
      name: 'Gradient Studio',
      description: 'Synthesize, preview, and export high-precision CSS linear, radial, and conic color gradients with copyable Tailwind classes.',
      category: 'Design & Assets',
      icon: Paintbrush,
      badge: 'CSS Studio',
      badgeStyle: 'bg-rose-50 text-rose-700 border-rose-200/80',
      iconBg: 'bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-md shadow-rose-500/20',
      hoverBorder: 'hover:border-rose-400/80',
      accentColor: 'group-hover:text-rose-600',
      stats: 'Designer Suite'
    },
    {
      id: 'password',
      name: 'Cryptographic Key Generator',
      description: 'Generate high-entropy cryptographically secure random passwords or memorable readable passphrases with custom rules and audit logs.',
      category: 'Security & Keys',
      icon: Key,
      badge: 'High Entropy',
      badgeStyle: 'bg-amber-50 text-amber-800 border-amber-200/80',
      iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20',
      hoverBorder: 'hover:border-amber-400/80',
      accentColor: 'group-hover:text-amber-600',
      stats: 'Cryptographic'
    }
  ];

  const categories = [
    { id: 'all', label: 'All Tools', count: tools.length },
    { id: 'AI & Quality Assurance', label: 'AI & QA', count: tools.filter(t => t.category === 'AI & Quality Assurance').length },
    { id: 'Design & Assets', label: 'Design & Assets', count: tools.filter(t => t.category === 'Design & Assets').length },
    { id: 'Security & Keys', label: 'Security', count: tools.filter(t => t.category === 'Security & Keys').length },
  ];

  const filteredTools = tools.filter((tool) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      tool.name.toLowerCase().includes(query) ||
      tool.description.toLowerCase().includes(query) ||
      tool.category.toLowerCase().includes(query) ||
      tool.badge.toLowerCase().includes(query);

    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search tools (press '/' to focus)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-16 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-900 placeholder:text-slate-400"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-300 rounded-md h-5 w-5 flex items-center justify-center cursor-pointer transition-colors"
                title="Clear search"
              >
                ×
              </button>
            ) : (
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded">
                /
              </kbd>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg overflow-x-auto min-w-0">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                selectedCategory === cat.id
                  ? 'bg-white text-slate-950 font-semibold'
                  : 'text-slate-600 hover:bg-slate-300/70 hover:text-slate-950'
              }`}
            >
              <span>{cat.label}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                selectedCategory === cat.id ? 'bg-blue-100 text-blue-800 font-bold' : 'bg-slate-300/70 text-slate-600'
              }`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredTools.map((tool) => {
          const Icon = tool.icon;
          const isFav = favorites.includes(tool.id);
          return (
            <div
              key={tool.id}
              onMouseEnter={() => prefetchTool(tool.id)}
              onFocus={() => prefetchTool(tool.id)}
              onClick={() => onSelectTool(tool.id)}
              className={`group bg-white border border-slate-200 rounded-xl p-4 ${tool.hoverBorder} transition-colors duration-150 cursor-pointer flex flex-col gap-3`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2.5 rounded-lg ${tool.iconBg} flex items-center justify-center shrink-0`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className={`font-bold text-sm text-slate-900 tracking-tight truncate ${tool.accentColor} transition-colors`}>
                      {tool.name}
                    </h3>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 truncate block">
                      {tool.category}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => onToggleFavorite(tool.id, e)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-rose-600 transition-colors cursor-pointer shrink-0"
                  title={isFav ? "Remove from Favorites" : "Mark as Favorite"}
                >
                  <Heart className={`h-4 w-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 flex-1">
                {tool.description}
              </p>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tool.badgeStyle}`}>
                  {tool.badge}
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-900 transition-colors" />
              </div>
            </div>
          );
        })}

        {filteredTools.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white border border-dashed border-slate-300 rounded-xl space-y-3">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Search className="h-6 w-6" />
            </div>
            <h4 className="font-bold text-base text-slate-900">No matching tools found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">We couldn't find anything matching "{searchQuery}". Try another keyword or reset the category filters.</p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
