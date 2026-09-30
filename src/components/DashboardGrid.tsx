import React, { useState, useRef, useEffect } from 'react';
import {
  FileImage, Paintbrush, Key, ArrowRight, Heart,
  Search, ShieldCheck, FileCode, MonitorSmartphone, Braces
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
      id: 'schema-generator',
      name: 'Schema Generator',
      description: 'Generate Schema.org JSON-LD structured data markup, starting with FAQPage schema built from your own questions and answers.',
      category: 'Schema & SEO',
      icon: Braces,
      badge: 'FAQ Schema',
      badgeStyle: 'bg-sky-50 text-sky-700 border-sky-200/80',
      iconBg: 'bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-md shadow-sky-500/20',
      hoverBorder: 'hover:border-sky-400/80',
      accentColor: 'group-hover:text-sky-600',
      stats: 'JSON-LD'
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
    { id: 'Schema & SEO', label: 'Schema & SEO', count: tools.filter(t => t.category === 'Schema & SEO').length },
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

  const toolSections = categories
    .filter((category) => category.id !== 'all')
    .map((category) => ({
      ...category,
      tools: filteredTools.filter((tool) => tool.category === category.id),
    }))
    .filter((section) => section.tools.length > 0);

  const categoryCount = categories.length - 1;

  const getSectionLayoutClasses = (toolCount: number) => {
    if (toolCount >= 3) return { section: 'md:col-span-2 lg:col-span-3', grid: 'md:grid-cols-2 lg:grid-cols-3' };
    if (toolCount === 2) return { section: 'md:col-span-2', grid: 'md:grid-cols-2' };
    return { section: '', grid: '' };
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-slate-900 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 px-6 py-7 md:px-8 md:py-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-4 min-w-0">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Developer & Web QA Toolkit</h2>
            <p className="text-sm text-slate-400 mt-1.5 max-w-xl">
              Audit pages, generate markup, prepare assets and create secure keys, all from one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-semibold text-slate-200">
              <span className="text-white font-bold">{tools.length}</span> tools
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-semibold text-slate-200">
              <span className="text-white font-bold">{categoryCount}</span> categories
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-semibold text-slate-200">
              <span className="text-white font-bold">{favorites.length}</span> favorites
            </span>
          </div>
        </div>

        <div className="relative w-full lg:max-w-sm shrink-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search tools (press '/' to focus)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-16 py-3 text-sm rounded-xl border border-transparent bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/40 text-slate-900 placeholder:text-slate-400"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
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
      </section>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 text-xs font-semibold rounded-full border transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              selectedCategory === cat.id
                ? 'bg-slate-900 border-slate-900 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-200 hover:text-slate-950'
            }`}
          >
            <span>{cat.label}</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
              selectedCategory === cat.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {cat.count}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-6">
      {toolSections.map((section) => {
        const layoutClasses = getSectionLayoutClasses(section.tools.length);
        return (
        <section key={section.id} className={`space-y-3 ${layoutClasses.section}`}>
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">{section.id}</h3>
            <span className="text-[11px] font-mono font-semibold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full">{section.tools.length}</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className={`grid grid-cols-1 gap-4 ${layoutClasses.grid}`}>
            {section.tools.map((tool) => {
              const Icon = tool.icon;
              const isFav = favorites.includes(tool.id);
              return (
                <div
                  key={tool.id}
                  onMouseEnter={() => prefetchTool(tool.id)}
                  onFocus={() => prefetchTool(tool.id)}
                  onClick={() => onSelectTool(tool.id)}
                  className={`group bg-white border border-slate-200 rounded-2xl p-5 ${tool.hoverBorder} hover:bg-slate-50 transition-colors cursor-pointer flex flex-col gap-4`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={`h-12 w-12 rounded-xl ${tool.iconBg} flex items-center justify-center shrink-0`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <button
                      onClick={(e) => onToggleFavorite(tool.id, e)}
                      className="p-2 rounded-lg text-slate-400 hover:bg-rose-100 hover:text-rose-600 transition-colors cursor-pointer shrink-0"
                      title={isFav ? "Remove from Favorites" : "Mark as Favorite"}
                    >
                      <Heart className={`h-4 w-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </button>
                  </div>

                  <div className="space-y-1.5 flex-1">
                    <h4 className={`font-bold text-base text-slate-900 tracking-tight ${tool.accentColor} transition-colors`}>
                      {tool.name}
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                      {tool.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${tool.badgeStyle}`}>
                        {tool.badge}
                      </span>
                      <span className="text-xs font-medium text-slate-400 truncate">{tool.stats}</span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 group-hover:text-slate-900 transition-colors shrink-0">
                      Open
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        );
      })}
      </div>

      {filteredTools.length === 0 && (
        <div className="py-16 text-center bg-white border border-dashed border-slate-300 rounded-2xl space-y-3">
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
  );
}
