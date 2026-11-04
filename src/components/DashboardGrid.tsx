import React, { useEffect, useRef, useState } from 'react';
import {
  FileImage, Paintbrush, Key, Heart,
  ShieldCheck, FileCode, MonitorSmartphone, Braces, Search, ChevronLeft, ChevronRight
} from 'lucide-react';
import { prefetchTool } from '../App';

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

/** Accent ramp from design.md §2 — glyph color per tile fill is a hard rule. */
interface ToolDef {
  id: string;
  name: string;
  description: string;
  category: Exclude<CategoryId, 'all' | 'time'>;
  icon: React.ElementType;
  acc: string;
  /** true when the tile fill requires an ink glyph (green/sky/cyan/amber) */
  inkGlyph: boolean;
}

const tools: ToolDef[] = [
  {
    id: 'seo-checker',
    name: 'SEO & Schema Validator',
    description: 'Audit meta, Open Graph and structured data.',
    category: 'web',
    icon: Search,
    acc: 'var(--blue)',
    inkGlyph: false,
  },
  {
    id: 'responsive-preview',
    name: 'Responsive Preview',
    description: 'Test any URL across device viewports.',
    category: 'web',
    icon: MonitorSmartphone,
    acc: 'var(--green)',
    inkGlyph: true,
  },
  {
    id: 'content-checker',
    name: 'Content Audit',
    description: 'Compare live copy with your reference doc.',
    category: 'web',
    icon: ShieldCheck,
    acc: 'var(--indigo)',
    inkGlyph: false,
  },
  {
    id: 'schema-generator',
    name: 'Schema Generator',
    description: 'Build FAQPage JSON-LD markup.',
    category: 'developer',
    icon: Braces,
    acc: 'var(--sky)',
    inkGlyph: true,
  },
  {
    id: 'html-cleaner',
    name: 'HTML Cleaner',
    description: 'Strip styles, trackers and Word bloat.',
    category: 'text',
    icon: FileCode,
    acc: 'var(--cyan)',
    inkGlyph: true,
  },
  {
    id: 'image',
    name: 'Image Converter',
    description: 'Batch-convert to WebP, AVIF, PNG or JPEG.',
    category: 'design',
    icon: FileImage,
    acc: 'var(--purple)',
    inkGlyph: false,
  },
  {
    id: 'gradient',
    name: 'Gradient Studio',
    description: 'Craft and export CSS gradients.',
    category: 'design',
    icon: Paintbrush,
    acc: 'var(--rose)',
    inkGlyph: false,
  },
  {
    id: 'password',
    name: 'Password Generator',
    description: 'Generate strong passwords locally.',
    category: 'security',
    icon: Key,
    acc: 'var(--amber)',
    inkGlyph: true,
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

  // Up to 4 cards sit in one centered row; beyond that two rows grow sideways into the slider.
  const columnCount = Math.max(1, visibleTools.length <= 4 ? visibleTools.length : Math.ceil(visibleTools.length / 2));

  const trackRef = useRef<HTMLDivElement>(null);
  const [scrollEdges, setScrollEdges] = useState({ atStart: true, atEnd: true });
  const isOverflowing = !(scrollEdges.atStart && scrollEdges.atEnd);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const updateEdges = () => setScrollEdges({
      atStart: track.scrollLeft <= 1,
      atEnd: track.scrollLeft + track.clientWidth >= track.scrollWidth - 1,
    });
    updateEdges();
    track.addEventListener('scroll', updateEdges, { passive: true });
    const resizeObserver = new ResizeObserver(updateEdges);
    resizeObserver.observe(track);
    return () => {
      track.removeEventListener('scroll', updateEdges);
      resizeObserver.disconnect();
    };
  }, [activeCategory, visibleTools.length]);

  const slide = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  return (
    <div
      className="pop-page px-4 md:px-5 py-4 md:py-5 flex flex-col min-h-[calc(100vh-3.5rem)] md:min-h-screen pb-10"
      key={activeCategory}
    >
      <div className="pop-container w-full pt-10 md:pt-14">
        {/* ---------- headline ---------- */}
        <div className="flex items-start justify-between gap-6">
          <div className="relative min-w-0">
            <p className="pop-kicker" style={{ color: 'var(--on-page-soft)' }}>
              Small utilities · Faster workflows
            </p>
            <h2 className="pop-display mt-2" style={{ color: 'var(--on-page)' }}>
              Utility <span className="pop-outline">Studio</span>
            </h2>
            <span
              className="pop-sticker pop-debut absolute -top-7 right-0 hidden lg:inline-block"
            >
              100% Local
            </span>
          </div>
        </div>

        {/* ---------- filters ---------- */}
        <div className="flex items-end justify-between gap-6 mt-9 mb-7">
        <div
          role="group"
          aria-label="Filter tools by category"
          className="flex flex-wrap gap-2.5 flex-1 min-w-0"
        >
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              aria-pressed={activeCategory === category.id}
              className="pop-pill"
            >
              {category.label}
              <sup>{categoryCounts[category.id]}</sup>
            </button>
          ))}
        </div>

          {isOverflowing && (
            <div className="hidden md:flex gap-2.5 shrink-0">
              <button type="button" className="pop-arrow" onClick={() => slide(-1)} disabled={scrollEdges.atStart} aria-label="Scroll tools left">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button type="button" className="pop-arrow" onClick={() => slide(1)} disabled={scrollEdges.atEnd} aria-label="Scroll tools right">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        {/* ---------- tool slider ---------- */}
        <div
          ref={trackRef}
          className="pop-track"
          role="region"
          aria-label="Tools"
          style={{ '--cols': columnCount } as React.CSSProperties}
        >
          {visibleTools.map((tool, index) => {
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
                className="pop-card pop-in group flex flex-col"
                style={{
                  '--acc': tool.acc,
                  '--i': index,
                } as React.CSSProperties}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="pop-badge">
                    <i aria-hidden="true" />
                    {categoryLabels[tool.category]}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => onToggleFavorite(tool.id, e)}
                      className="pop-heart"
                      aria-pressed={isPinned}
                      title={isPinned ? 'Remove from Favorites' : 'Mark as Favorite'}
                      aria-label={isPinned ? `${tool.name}: remove from Favorites` : `${tool.name}: mark as Favorite`}
                    >
                      <Heart className="h-4 w-4" fill={isPinned ? 'currentColor' : 'none'} />
                    </button>
                    <span className="pop-num">#{String(index + 1).padStart(2, '0')}</span>
                  </div>
                </div>

                <div className={`pop-tile mt-3.5${tool.inkGlyph ? ' pop-tile--ink-text' : ''}`}>
                  <Icon size={22} strokeWidth={2} />
                </div>

                <h3 className="mt-3.5 font-display font-bold uppercase text-[16px] leading-[1.1] text-ink">
                  {tool.name}
                </h3>
                <p className="mt-1 text-[12.5px] leading-[1.55]" style={{ color: 'var(--ink-muted)' }}>
                  {tool.description}
                </p>
              </div>
            );
          })}
        </div>

        {visibleTools.length === 0 && (
          <div className="pop-empty">
            <h4 className="font-display font-bold uppercase text-sm tracking-[.08em]">
              Nothing here yet
            </h4>
            <p className="mt-1 text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
              No tools in the {categoryLabels[activeCategory]} category.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
