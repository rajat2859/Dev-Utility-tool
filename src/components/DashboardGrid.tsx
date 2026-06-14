import React, { useState } from 'react';
import { Search, Star, MessageSquareCode, ShieldCheck, Binary, Clock, Type, Palette, ArrowRight } from 'lucide-react';
import { Tool, ToolCategory } from '../types';

interface DashboardGridProps {
  onSelectTool: (toolId: string) => void;
  favorites: string[];
  onToggleFavorite: (toolId: string, event: React.MouseEvent) => void;
  userEmail?: string;
}

export default function DashboardGrid({ onSelectTool, favorites, onToggleFavorite, userEmail }: DashboardGridProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ToolCategory | 'all'>('all');

  const toolsList: Tool[] = [
    {
      id: 'json',
      name: 'JSON Formatter & Validator',
      description: 'Format, validate, prettify, or minify raw JSON string layouts with syntax checking support.',
      category: 'development',
      iconName: 'json'
    },
    {
      id: 'encoding',
      name: 'Base64 & URL Translator',
      description: 'Convert Base64 payloads, URL paths, HTML entity codes, and generate safe secure hashes (SHA-256).',
      category: 'encoding',
      iconName: 'encoding'
    },
    {
      id: 'generator',
      name: 'Password & UUID Generator',
      description: 'Generate high-entropy credentials, secure UUID v4 tokens, or custom cryptographic hex byte keys.',
      category: 'generators',
      iconName: 'generator'
    },
    {
      id: 'timestamp',
      name: 'Unix Epoch Converter',
      description: 'Convert timestamp values to UTC, local dates, and check elapsed relative schedules in real-time.',
      category: 'converters',
      iconName: 'timestamp'
    },
    {
      id: 'text',
      name: 'Text Metrics & Analyzer',
      description: 'Check words, characters counting, estimate reading schedules, and transform general text letter casing layouts.',
      category: 'development',
      iconName: 'text'
    },
    {
      id: 'color',
      name: 'Contrast & Palette Tool',
      description: 'Convert RGB/HSL color spaces, generate palettes, and verify accessibility WCAG criteria.',
      category: 'design',
      iconName: 'color'
    }
  ];

  const getToolIcon = (name: string) => {
    switch (name) {
      case 'json':
        return <MessageSquareCode className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />;
      case 'encoding':
        return <ShieldCheck className="h-5 w-5 text-teal-600 dark:text-teal-400" />;
      case 'generator':
        return <Binary className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
      case 'timestamp':
        return <Clock className="h-5 w-5 text-rose-600 dark:text-rose-400" />;
      case 'text':
        return <Type className="h-5 w-5 text-sky-600 dark:text-sky-400" />;
      case 'color':
        return <Palette className="h-5 w-5 text-purple-600 dark:text-purple-400" />;
      default:
        return <MessageSquareCode className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />;
    }
  };

  const filteredTools = toolsList.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || 
                          t.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-950 p-6 md:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden border border-indigo-900/30">
        <div className="absolute inset-x-0 bottom-0 h-40 bg-[radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        
        <div className="relative space-y-2 max-w-2xl">
          <span className="text-[10px] md:text-xs font-semibold tracking-widest text-indigo-300 uppercase block">Welcome to Utility Hub</span>
          <h1 className="text-2xl md:text-3.5xl font-extrabold tracking-tight md:leading-tight">
            Streamline your daily operations on a single unified canvas.
          </h1>
          <p className="text-xs md:text-sm text-indigo-200/80 leading-relaxed">
            Quickly resolve formatted templates, encrypt cryptographic fields, convert epoch intervals, and verify content designs offline with absolute privacy.
          </p>
          {userEmail && (
            <div className="pt-2 flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400 text-xs font-semibold">Workspace Operator: {userEmail}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {['all', 'development', 'encoding', 'generators', 'converters', 'design'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                activeCategory === cat
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 dark:bg-elegant-card dark:border-elegant-border dark:text-slate-400 hover:border-slate-300 dark:hover:border-neutral-700'
              }`}
            >
              {cat === 'all' ? 'All categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search matching tools..."
            className="w-full pl-10 pr-4 py-2 text-xs md:text-sm border border-slate-200 dark:border-elegant-border rounded-xl bg-white dark:bg-elegant-card text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTools.map((tool) => {
          const isFav = favorites.includes(tool.id);
          return (
            <div
              key={tool.id}
              onClick={() => onSelectTool(tool.id)}
              className="bg-white dark:bg-elegant-card border border-slate-200 dark:border-elegant-border p-6 rounded-2xl shadow-xs hover:shadow-md hover:-translate-y-1 hover:border-indigo-400 dark:hover:border-indigo-900/60 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-elegant-bg border border-slate-100 dark:border-elegant-border">
                    {getToolIcon(tool.iconName)}
                  </div>
                  <button
                    onClick={(e) => onToggleFavorite(tool.id, e)}
                    className="p-1.5 rounded-lg border border-slate-100 text-slate-350 hover:text-amber-500 hover:bg-slate-50 dark:border-elegant-border dark:hover:bg-elegant-card-hover cursor-pointer transition-colors"
                  >
                    <Star className={`h-4.5 w-4.5 ${isFav ? 'fill-amber-500 text-amber-500' : ''}`} />
                  </button>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-base tracking-tight text-slate-850 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {tool.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    {tool.description}
                  </p>
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-slate-100 dark:border-elegant-border flex items-center justify-between text-xs font-semibold text-slate-400">
                <span className="capitalize text-[10px] bg-slate-50 dark:bg-elegant-bg text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-md border border-slate-100 dark:border-elegant-border">
                  {tool.category}
                </span>
                <span className="text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                  Activate Tool
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          );
        })}

        {filteredTools.length === 0 && (
          <div className="col-span-full border border-dashed border-slate-205 dark:border-slate-800 p-12 text-center rounded-2xl bg-slate-50/10">
            <span className="text-sm font-semibold text-slate-400 block mb-1">No services matched your query</span>
            <span className="text-xs text-slate-400">Try modifying your text criteria or switching active categories above.</span>
          </div>
        )}
      </div>
    </div>
  );
}
