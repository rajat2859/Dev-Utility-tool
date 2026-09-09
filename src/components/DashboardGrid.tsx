import React, { useState, useRef, useEffect } from 'react';
import {
  FileImage, Paintbrush, Key, ArrowRight, Heart, Sparkles, Terminal,
  Search, ShieldCheck, Zap, FileCode, MonitorSmartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
      hoverBorder: 'hover:border-blue-400/80 hover:shadow-lg hover:shadow-blue-500/10',
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
      hoverBorder: 'hover:border-indigo-400/80 hover:shadow-lg hover:shadow-indigo-500/10',
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
      hoverBorder: 'hover:border-emerald-400/80 hover:shadow-lg hover:shadow-emerald-500/10',
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
      hoverBorder: 'hover:border-cyan-400/80 hover:shadow-lg hover:shadow-cyan-500/10',
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
      hoverBorder: 'hover:border-purple-400/80 hover:shadow-lg hover:shadow-purple-500/10',
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
      hoverBorder: 'hover:border-rose-400/80 hover:shadow-lg hover:shadow-rose-500/10',
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
      hoverBorder: 'hover:border-amber-400/80 hover:shadow-lg hover:shadow-amber-500/10',
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
    <div className="space-y-6 pb-6">
      {/* Hero Executive Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-[#0a0f1d] to-[#0f172a] rounded-3xl p-6 sm:p-8 md:p-10 text-white shadow-xl shadow-slate-950/20 border border-slate-800/80">
        {/* Glow Spheres */}
        <div className="absolute -left-16 -top-16 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-10 -top-10 w-64 h-64 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-0 bottom-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Geometric Terminal Backdrop Pattern */}
        <div className="absolute right-4 bottom-4 opacity-5 pointer-events-none text-white">
          <Terminal size={260} />
        </div>

        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-300 border border-blue-400/25 shadow-xs backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
            <span>Developer Suite · Precision v2.5</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Developer & Designer Precision Workspace
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
            Ultra-fast suite of utility tools optimized for instant client-side execution, multi-device viewport testing, and AI content compliance.
          </p>

          <div className="pt-2 text-xs font-mono flex flex-wrap gap-2.5 items-center">
            <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800/90 text-slate-300 shadow-2xs">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span>Response: <span className="text-emerald-400 font-semibold">&lt;1ms Local</span></span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800/90 text-slate-300 shadow-2xs">
              <MonitorSmartphone className="h-3.5 w-3.5 text-cyan-400" />
              <span>Lab: <span className="text-cyan-300 font-semibold">11 Device Presets</span></span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800/90 text-slate-300 shadow-2xs">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
              <span>Audit: <span className="text-indigo-300 font-semibold">AI Vision + OCR</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Bar: Search & Category Tabs */}
      <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between pt-1">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search tools or keywords (Press '/' to focus)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-16 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200/90 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/80 transition-all text-slate-900 placeholder:text-slate-400 shadow-2xs"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs font-semibold text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md h-5 w-5 flex items-center justify-center cursor-pointer transition-colors"
                title="Clear search"
              >
                ×
              </button>
            ) : (
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-slate-100 border border-slate-200/90 rounded">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl border border-slate-300/60 overflow-x-auto min-w-0 shadow-2xs">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`relative px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                selectedCategory === cat.id
                  ? 'text-slate-950 font-semibold'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              {selectedCategory === cat.id && (
                <motion.div
                  layoutId="activeCategoryPill"
                  className="absolute inset-0 bg-white rounded-lg border border-slate-200/80 shadow-2xs"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">{cat.label}</span>
              <span className={`relative z-10 text-[10px] font-mono px-1.5 py-0.5 rounded-full transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-blue-100 text-blue-800 font-bold'
                  : 'bg-slate-300/70 text-slate-600'
              }`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tool Grid with Fast Stagger Animation */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: {
              staggerChildren: 0.03
            }
          }
        }}
      >
        {filteredTools.map((tool) => {
          const Icon = tool.icon;
          const isFav = favorites.includes(tool.id);
          return (
            <motion.div
              key={tool.id}
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0, transition: { duration: 0.14, ease: [0.16, 1, 0.3, 1] } }
              }}
              whileHover={{ y: -3, transition: { duration: 0.12 } }}
              onMouseEnter={() => prefetchTool(tool.id)}
              onFocus={() => prefetchTool(tool.id)}
              onClick={() => onSelectTool(tool.id)}
              className={`group relative bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs ${tool.hoverBorder} transition-all duration-150 cursor-pointer flex flex-col justify-between overflow-hidden gpu-layer`}
            >
              {/* Subtle gradient corner sheen */}
              <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-slate-100/70 to-transparent rounded-bl-full pointer-events-none group-hover:from-slate-100 transition-colors" />

              {/* Top Row: Badge & Favorite */}
              <div className="flex items-center justify-between gap-2 mb-4 relative z-10">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tool.badgeStyle}`}>
                  {tool.badge}
                </span>
                <motion.button
                  whileTap={{ scale: 0.8 }}
                  onClick={(e) => onToggleFavorite(tool.id, e)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-rose-600 transition-colors cursor-pointer"
                  title={isFav ? "Remove from Favorites" : "Mark as Favorite"}
                >
                  <Heart className={`h-4 w-4 transition-colors ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                </motion.button>
              </div>

              {/* Tool core info */}
              <div className="space-y-3 flex-1 mb-6 relative z-10">
                <div className="flex items-center gap-3.5">
                  <div className={`p-3 rounded-xl ${tool.iconBg} shadow-sm group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-200 flex items-center justify-center shrink-0`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className={`font-bold text-base text-slate-900 tracking-tight ${tool.accentColor} transition-colors`}>
                      {tool.name}
                    </h3>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                      {tool.category}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-normal pt-1">
                  {tool.description}
                </p>
              </div>

              {/* Action and stats footer */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-auto relative z-10">
                <span className="text-[10px] font-mono font-medium text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/80">
                  {tool.stats}
                </span>
                <span className={`flex items-center gap-1.5 text-xs font-semibold text-slate-900 ${tool.accentColor} transition-all`}>
                  <span>Launch Tool</span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:translate-x-1.5 transition-transform duration-150" />
                </span>
              </div>
            </motion.div>
          );
        })}

        {/* Empty state when search yields no result */}
        {filteredTools.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white border border-dashed border-slate-300/80 rounded-3xl space-y-3 shadow-2xs">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Search className="h-6 w-6" />
            </div>
            <h4 className="font-bold text-base text-slate-900">No matching tools found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">We couldn't find anything matching "{searchQuery}". Try another keyword or reset the category filters.</p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
            >
              Reset Filters
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
