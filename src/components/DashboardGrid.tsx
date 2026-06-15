import React, { useState } from 'react';
import { FileImage, Paintbrush, Key, ArrowRight, Heart, Sparkles, Terminal, Plus, Search } from 'lucide-react';

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

  const tools = [
    {
      id: 'image',
      name: 'Bulk Image Format Converter',
      description: 'Render and batch-convert local files into WebP, JPG, transparent PNG, or SVG vector tracings securely in the browser.',
      category: 'Design & Assets',
      icon: FileImage,
      badge: 'Highly Popular',
      stats: '⚡ 100% Offline'
    },
    {
      id: 'gradient',
      name: 'Gradient Studio',
      description: 'Generate, test, and export elegant CSS linear, radial, and conic color gradients to raw styling sheets or tailwind classes.',
      category: 'Design & Assets',
      icon: Paintbrush,
      badge: 'High Fidelity',
      stats: '💻 Designer Suite'
    },
    {
      id: 'password',
      name: 'Password Generator',
      description: 'Design and export highly secure, cryptographically-secure random passwords or memorable readable passphrases with custom rules.',
      category: 'Security Utilities',
      icon: Key,
      badge: 'Cryptographic',
      stats: '🔑 High Entropy'
    }
  ];

  const filteredTools = tools.filter(tool => 
    tool.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Banner hero section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl border border-indigo-900/40">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Terminal size={180} />
        </div>
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            <span>Browser-Native Engine</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Developer & Designer Tool Space
          </h1>
          <p className="text-sm md:text-base text-slate-300">
            A high-fidelity developer workspace built for speed. All operations are processed fully locally on your device with zero cloud latency and total privacy.
          </p>
          <div className="pt-2 text-xs text-indigo-400 font-mono flex flex-wrap gap-x-4 gap-y-1 items-center">
            <span>User session: <span className="text-slate-200">{userEmail}</span></span>
            <span className="hidden sm:inline">|</span>
            <span>All conversions secure (128-bit Sandbox)</span>
          </div>
        </div>
      </div>

      {/* Control bar */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search active utility tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white dark:bg-elegant-bg dark:border-elegant-border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 dark:text-neutral-200 shadow-xs"
          />
        </div>
        
        <div className="text-xs text-slate-500 font-mono font-semibold self-end sm:self-auto shrink-0 bg-slate-100 dark:bg-elegant-bg-hover px-3 py-1.5 rounded-lg border border-slate-200/50 dark:border-elegant-border">
          Active Tools: {filteredTools.length}
        </div>
      </div>

      {/* Tool grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTools.map((tool) => {
          const Icon = tool.icon;
          const isFav = favorites.includes(tool.id);
          return (
            <div
              key={tool.id}
              onClick={() => onSelectTool(tool.id)}
              className="group relative bg-white dark:bg-elegant-card border border-slate-200/80 dark:border-elegant-border rounded-2xl p-6 shadow-xs hover:shadow-md hover:border-slate-305 dark:hover:border-indigo-900/50 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              {/* Badge & Favorite */}
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30">
                  {tool.badge}
                </span>
                <button
                  onClick={(e) => onToggleFavorite(tool.id, e)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-rose-500 dark:hover:bg-elegant-bg transition-colors"
                  title={isFav ? "Remove from Favorites" : "Mark as Favorite"}
                >
                  <Heart className={`h-4.5 w-4.5 transition-transform duration-150 active:scale-125 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                </button>
              </div>

              {/* Tool core info */}
              <div className="space-y-3 flex-1 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200 flex items-center justify-center">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 dark:text-neutral-100 tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {tool.name}
                    </h3>
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500">
                      {tool.category}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  {tool.description}
                </p>
              </div>

              {/* Action and stats feet */}
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-elegant-border/70 pt-4 mt-auto">
                <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-405 bg-slate-50 dark:bg-elegant-bg px-2 py-1 rounded-md border border-slate-150 dark:border-elegant-border/40">
                  {tool.stats}
                </span>
                <span className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
                  <span>Open Tool</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          );
        })}

        {/* Placeholder utility grid slots (the user will add more) */}
        <div className="border border-dashed border-slate-300 dark:border-elegant-border/60 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-4 hover:border-indigo-300 dark:hover:border-indigo-900/30 transition-colors bg-slate-50/20 dark:bg-slate-900/5 min-h-[220px]">
          <div className="h-10 w-10 rounded-full border border-dashed border-slate-300 dark:border-elegant-border/60 flex items-center justify-center text-slate-400 dark:text-slate-500">
            <Plus className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">Custom Work In Progress</h4>
            <p className="text-xs text-slate-405 dark:text-slate-500 max-w-[200px]">
              Drop new tools or utility specifications here to expand your suite.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
