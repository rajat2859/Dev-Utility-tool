import React, { useState } from 'react';
import { FileImage, Paintbrush, Key, ArrowRight, Heart, Sparkles, Terminal, Search, ShieldCheck, Zap, CheckCircle2, Activity, FileCode } from 'lucide-react';
import { motion } from 'motion/react';
import { prefetchTool } from '../App';

interface DashboardGridProps {
  onSelectTool: (toolId: string) => void;
  favorites: string[];
  onToggleFavorite: (toolId: string, event: React.MouseEvent) => void;
  userEmail: string;
}

export default function DashboardGrid({
  onSelectTool,
  favorites,
  onToggleFavorite,
  userEmail,
}: DashboardGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const tools = [
    {
      id: 'seo-checker',
      name: 'SEO & Schema Auditor',
      description: 'Audit webpage meta title lengths, descriptions, Google SERP snippet previews, Open Graph tags, and Schema.org structured data validity.',
      category: 'AI & Quality Assurance',
      icon: Search,
      badge: 'SEO Inspector',
      badgeStyle: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      iconBg: 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-indigo-200/50',
      hoverBorder: 'hover:border-indigo-300 hover:shadow-indigo-100/50',
      stats: 'SEO & Schemas'
    },
    {
      id: 'content-checker',
      name: 'Auditor',
      description: 'AI-powered visual copy and screenshot compliance auditor. Compares live webpage copy against reference Awesome Screenshot designs.',
      category: 'AI & Quality Assurance',
      icon: ShieldCheck,
      badge: 'Visual AI',
      badgeStyle: 'bg-purple-100 text-purple-700 border-purple-200',
      iconBg: 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-purple-200/50',
      hoverBorder: 'hover:border-purple-300 hover:shadow-purple-100/50',
      stats: 'Visual QA'
    },
    {
      id: 'html-cleaner',
      name: 'HTML Cleaner & Sanitizer',
      description: 'Strip dirty inline styles, tracking scripts, Word document bloat, and broken tags instantly with custom sanitizer rules and live previews.',
      category: 'Design & Assets',
      icon: FileCode,
      badge: 'Sanitizer',
      badgeStyle: 'bg-sky-100 text-sky-800 border-sky-200',
      iconBg: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sky-200/50',
      hoverBorder: 'hover:border-sky-300 hover:shadow-sky-100/50',
      stats: '100% Offline'
    },
    {
      id: 'image',
      name: 'Bulk Image Format Converter',
      description: 'Render and batch-convert local image files into WebP, AVIF, transparent PNG, JPEG or SVG vector tracings with real-time size forecasting.',
      category: 'Design & Assets',
      icon: FileImage,
      badge: 'High Speed',
      badgeStyle: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-200/50',
      hoverBorder: 'hover:border-emerald-300 hover:shadow-emerald-100/50',
      stats: '100% Offline'
    },
    {
      id: 'gradient',
      name: 'Gradient Studio',
      description: 'Synthesize, preview, and export high-precision CSS linear, radial, and conic color gradients with copyable Tailwind classes.',
      category: 'Design & Assets',
      icon: Paintbrush,
      badge: 'CSS Synthesizer',
      badgeStyle: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
      iconBg: 'bg-gradient-to-br from-fuchsia-500 to-pink-600 text-white shadow-fuchsia-200/50',
      hoverBorder: 'hover:border-fuchsia-300 hover:shadow-fuchsia-100/50',
      stats: 'Designer Suite'
    },
    {
      id: 'password',
      name: 'Cryptographic Key Generator',
      description: 'Generate high-entropy cryptographically secure random passwords or memorable readable passphrases with custom rules and audit logs.',
      category: 'Security & Keys',
      icon: Key,
      badge: 'High Entropy',
      badgeStyle: 'bg-amber-100 text-amber-800 border-amber-200',
      iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-amber-200/50',
      hoverBorder: 'hover:border-amber-300 hover:shadow-amber-100/50',
      stats: 'Cryptographic'
    }
  ];

  const categories = [
    { id: 'all', label: 'All Tools' },
    { id: 'AI & Quality Assurance', label: 'AI & QA' },
    { id: 'Design & Assets', label: 'Design & Assets' },
    { id: 'Security & Keys', label: 'Security & Keys' },
  ];

  const filteredTools = tools.filter(tool => {
    const matchesSearch = 
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Hero Banner Section */}
      <div className="relative overflow-hidden bg-slate-950 rounded-2xl p-6 md:p-8 text-white shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 p-8 opacity-15 pointer-events-none text-indigo-400">
          <Terminal size={220} />
        </div>
        <div className="absolute -left-12 -top-12 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 shadow-xs backdrop-blur-xs">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
            <span>Utility Tool Manager v2.0</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
            Developer & Designer Precision Workspace
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed font-normal">
            An ultra-fast suite of utility tools optimized for instant client-side execution, crisp visual accuracy, and AI content analysis.
          </p>
          <div className="pt-2 text-xs text-slate-400 font-mono flex flex-wrap gap-x-4 gap-y-2 items-center">
            <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded-md border border-slate-800">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>User: <span className="text-slate-200 font-medium">{userEmail}</span></span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded-md border border-slate-800">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span>Response Time: <span className="text-emerald-400 font-semibold">&lt;1ms</span></span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded-md border border-slate-800">
              <Activity className="h-3.5 w-3.5 text-indigo-400" />
              <span>Status: <span className="text-indigo-300 font-semibold">Ultra Fast</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Control bar */}
      <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search tools, formats, or security keys..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-8 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all text-slate-900 placeholder:text-slate-400 shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md h-5 w-5 flex items-center justify-center cursor-pointer transition-colors"
            >
              ×
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 overflow-x-auto shrink-0">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`relative px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'text-slate-950 font-semibold shadow-2xs'
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
            </button>
          ))}
        </div>
      </div>

      {/* Tool Grid with Fast Stagger Animation */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-5"
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: {
              staggerChildren: 0.04
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
                hidden: { opacity: 0, y: 8 },
                show: { opacity: 1, y: 0, transition: { duration: 0.12 } }
              }}
              whileHover={{ y: -2, transition: { duration: 0.1 } }}
              onMouseEnter={() => prefetchTool(tool.id)}
              onFocus={() => prefetchTool(tool.id)}
              onClick={() => onSelectTool(tool.id)}
              className={`group relative bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs hover:shadow-md ${tool.hoverBorder} transition-all duration-150 cursor-pointer flex flex-col justify-between overflow-hidden`}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-slate-100/60 to-transparent rounded-bl-full pointer-events-none group-hover:from-slate-100 transition-colors" />

              {/* Top Row: Badge & Favorite */}
              <div className="flex items-center justify-between gap-2 mb-4 relative z-10">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tool.badgeStyle}`}>
                  {tool.badge}
                </span>
                <button
                  onClick={(e) => onToggleFavorite(tool.id, e)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-rose-600 transition-colors cursor-pointer"
                  title={isFav ? "Remove from Favorites" : "Mark as Favorite"}
                >
                  <Heart className={`h-4 w-4 transition-transform duration-150 active:scale-125 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                </button>
              </div>

              {/* Tool core info */}
              <div className="space-y-3 flex-1 mb-6 relative z-10">
                <div className="flex items-center gap-3.5">
                  <div className={`p-3 rounded-xl ${tool.iconBg} shadow-sm group-hover:scale-105 transition-transform duration-150 flex items-center justify-center shrink-0`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">
                      {tool.name}
                    </h3>
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
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
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all">
                  <span>Launch Tool</span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600" />
                </span>
              </div>
            </motion.div>
          );
        })}

        {/* Empty state when search yields no result */}
        {filteredTools.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white border border-dashed border-slate-200 rounded-2xl space-y-2">
            <Search className="h-8 w-8 text-slate-300 mx-auto" />
            <h4 className="font-semibold text-sm text-slate-800">No matching tools found</h4>
            <p className="text-xs text-slate-500">Try searching for another keyword or reset category filters.</p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
              className="mt-2 text-xs font-semibold text-indigo-600 underline hover:text-indigo-800 cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
