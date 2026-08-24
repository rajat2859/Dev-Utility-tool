import React, { useState, useRef, useEffect } from 'react';
import {
  Copy,
  Check,
  RefreshCw,
  Plus,
  Trash2,
  ArrowRightLeft,
  LayoutGrid,
  FileDown,
  Layers,
  MoveRight,
  Paintbrush,
  Sparkles,
  Code,
  Bookmark,
  BookmarkCheck,
  Eye,
  ShieldCheck,
  ShieldAlert,
  Wand2,
  Share2,
  Search,
  CheckCircle2,
  Upload,
  X
} from 'lucide-react';

interface ColorStop {
  id: string;
  color: string;
  stop: number;
  opacity: number; // 0 to 100
}

interface MeshPoint {
  id: string;
  color: string;
  x: number; // 0 to 100%
  y: number; // 0 to 100%
  radius: number; // 20 to 100%
}

interface SavedGradient {
  id: string;
  name: string;
  type: 'linear' | 'radial' | 'conic' | 'mesh';
  angle: number;
  stops: ColorStop[];
  createdAt: number;
}

const PRESETS = [
  { name: 'Hyper Light', colors: ['#ec4899', '#8b5cf6', '#3b82f6'], stops: [0, 50, 100], type: 'linear' as const, category: 'Vibrant' },
  { name: 'Warm Sunset', colors: ['#f97316', '#ec4899', '#ef4444'], stops: [0, 50, 100], type: 'linear' as const, category: 'Sunset & Nature' },
  { name: 'Oceanic Breeze', colors: ['#06b6d4', '#3b82f6', '#1d4ed8'], stops: [0, 45, 100], type: 'linear' as const, category: 'Sunset & Nature' },
  { name: 'Emerald Forest', colors: ['#34d399', '#10b981', '#059669'], stops: [0, 60, 100], type: 'linear' as const, category: 'Sunset & Nature' },
  { name: 'Cyberpunk Neon', colors: ['#0f172a', '#3b0764', '#0284c7'], stops: [0, 50, 100], type: 'linear' as const, category: 'Dark & Cyber' },
  { name: 'Deep Space', colors: ['#0f172a', '#1e293b', '#475569'], stops: [0, 50, 100], type: 'linear' as const, category: 'Dark & Cyber' },
  { name: 'Instagram Glow', colors: ['#833ab4', '#fd1d1d', '#fcb045'], stops: [0, 50, 100], type: 'linear' as const, category: 'Brand Icons' },
  { name: 'Stripe Silk', colors: ['#6366f1', '#a855f7', '#ec4899'], stops: [0, 50, 100], type: 'linear' as const, category: 'Brand Icons' },
  { name: 'Spotify Wave', colors: ['#1ed760', '#121212'], stops: [0, 100], type: 'linear' as const, category: 'Brand Icons' },
  { name: 'Vercel Dusk', colors: ['#000000', '#434343'], stops: [0, 100], type: 'linear' as const, category: 'Dark & Cyber' },
  { name: 'Pastel Dream', colors: ['#fbcfe8', '#e0e7ff', '#bae6fd'], stops: [0, 50, 100], type: 'linear' as const, category: 'Pastels' },
  { name: 'Cotton Candy', colors: ['#fda4af', '#f0abfc', '#93c5fd'], stops: [0, 50, 100], type: 'linear' as const, category: 'Pastels' },
  { name: 'Aura Teal', colors: ['#4ade80', '#06b6d4', '#6366f1'], stops: [10, 55, 95], type: 'radial' as const, category: 'Aura Mesh' },
  { name: 'Retro Sunrise', colors: ['#facc15', '#f97316', '#dc2626'], stops: [0, 50, 100], type: 'conic' as const, category: 'Vibrant' }
];

const POSITION_KEYWORD_MAP: Record<string, [number, number]> = {
  center: [50, 50], top: [50, 0], bottom: [50, 100], left: [0, 50], right: [100, 50],
  'top left': [0, 0], 'left top': [0, 0], 'top right': [100, 0], 'right top': [100, 0],
  'bottom left': [0, 100], 'left bottom': [0, 100], 'bottom right': [100, 100], 'right bottom': [100, 100]
};

function hslToHex(hDeg: number, s: number, l: number): string {
  const hNorm = (((hDeg % 360) + 360) % 360) / 360;
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (pIn: number, qIn: number, tIn: number) => {
      let t = tIn;
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return pIn + (qIn - pIn) * 6 * t;
      if (t < 1 / 2) return qIn;
      if (t < 2 / 3) return pIn + (qIn - pIn) * (2 / 3 - t) * 6;
      return pIn;
    };
    r = hue2rgb(p, q, hNorm + 1 / 3);
    g = hue2rgb(p, q, hNorm);
    b = hue2rgb(p, q, hNorm - 1 / 3);
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgbTuple(hex: string): [number, number, number] {
  let clean = hex.replace('#', '');
  if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
  return [
    parseInt(clean.substring(0, 2), 16) || 0,
    parseInt(clean.substring(2, 4), 16) || 0,
    parseInt(clean.substring(4, 6), 16) || 0
  ];
}

function averageHexColors(colors: string[]): string {
  if (colors.length === 0) return '#888888';
  let r = 0, g = 0, b = 0;
  colors.forEach(c => {
    const [cr, cg, cb] = hexToRgbTuple(c);
    r += cr; g += cg; b += cb;
  });
  const n = colors.length;
  const toHex = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Approximates a gradient's dominant color by weighting each stop by the width
// of the band it dominates (its midpoint distance to its neighboring stops).
function computeAverageColor(colorStops: { color: string; stop: number }[]): string {
  if (colorStops.length === 0) return '#888888';
  const sorted = [...colorStops].sort((a, b) => a.stop - b.stop);
  if (sorted.length === 1) return sorted[0].color;

  let totalWeight = 0, rSum = 0, gSum = 0, bSum = 0;
  sorted.forEach((s, i) => {
    const left = i === 0 ? 0 : (sorted[i - 1].stop + s.stop) / 2;
    const right = i === sorted.length - 1 ? 100 : (s.stop + sorted[i + 1].stop) / 2;
    const weight = Math.max(right - left, 0.01);
    const [r, g, b] = hexToRgbTuple(s.color);
    rSum += r * weight; gSum += g * weight; bSum += b * weight;
    totalWeight += weight;
  });

  const toHex = (v: number) => Math.round(v / totalWeight).toString(16).padStart(2, '0');
  return `#${toHex(rSum)}${toHex(gSum)}${toHex(bSum)}`;
}

function getRelativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgbTuple(hex).map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrastRatio(hexA: string, hexB: string): number {
  const lA = getRelativeLuminance(hexA);
  const lB = getRelativeLuminance(hexB);
  return (Math.max(lA, lB) + 0.05) / (Math.min(lA, lB) + 0.05);
}

function contrastRating(ratio: number): { label: string; level: 'AAA' | 'AA' | 'partial' | 'fail' } {
  if (ratio >= 7) return { label: 'AAA', level: 'AAA' };
  if (ratio >= 4.5) return { label: 'AA', level: 'AA' };
  if (ratio >= 3) return { label: 'Large text only', level: 'partial' };
  return { label: 'Fails', level: 'fail' };
}

// A single hidden 1x1 canvas reused to resolve any valid CSS color (named colors,
// rgb/hsl/hwb/oklch/lab, etc.) to concrete sRGB bytes via the browser's own color
// parser + rasterizer, instead of hand-rolled regexes that can't cover every syntax.
let colorProbeCtx: CanvasRenderingContext2D | null = null;
function resolveCssColorToRgba(token: string): { r: number; g: number; b: number; a: number } | null {
  if (typeof document === 'undefined') return null;
  if (!colorProbeCtx) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    colorProbeCtx = canvas.getContext('2d', { willReadFrequently: true });
  }
  if (!colorProbeCtx) return null;

  const sentinel = 'rgba(1, 2, 3, 0.004)';
  colorProbeCtx.fillStyle = sentinel;
  const baseline = colorProbeCtx.fillStyle;
  colorProbeCtx.fillStyle = token;
  if (colorProbeCtx.fillStyle === baseline) return null; // browser silently rejected an unparsable token

  colorProbeCtx.clearRect(0, 0, 1, 1);
  colorProbeCtx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = colorProbeCtx.getImageData(0, 0, 1, 1).data;
  return { r, g, b, a: a / 255 };
}

function parseCssColorToken(token: string): { hex: string; opacity: number } | null {
  const t = token.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t)) {
    let hex = t;
    if (hex.length === 4) hex = '#' + hex.slice(1).split('').map(c => c + c).join('');
    return { hex: hex.toLowerCase(), opacity: 100 };
  }
  const resolved = resolveCssColorToRgba(t);
  if (!resolved) return null;
  const toHex = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
  return { hex: `#${toHex(resolved.r)}${toHex(resolved.g)}${toHex(resolved.b)}`, opacity: Math.round(resolved.a * 100) };
}

function splitTopLevel(str: string): string[] {
  const parts: string[] = [];
  let depth = 0, current = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

interface ParsedGradient {
  type: 'linear' | 'radial' | 'conic';
  angle: number;
  radialShape: 'circle' | 'ellipse';
  radialPosition: string;
  radialX: number;
  radialY: number;
  stops: { id: string; color: string; stop: number; opacity: number }[];
}

// Parses a pasted CSS gradient string (e.g. "linear-gradient(135deg, #6366f1 0%, #ec4899 100%)")
// into editor state. Returns null when the string isn't a recognizable gradient function.
function parseGradientCss(input: string): ParsedGradient | null {
  const cleaned = input.trim().replace(/^background(-image)?\s*:\s*/i, '').replace(/;+\s*$/, '');
  const match = cleaned.match(/^(linear|radial|conic)-gradient\(([\s\S]+)\)\s*$/i);
  if (!match) return null;

  const type = match[1].toLowerCase() as 'linear' | 'radial' | 'conic';
  const segments = splitTopLevel(match[2]);
  if (segments.length === 0) return null;

  let angle = type === 'conic' ? 0 : 135;
  let radialShape: 'circle' | 'ellipse' = 'circle';
  let radialPosition = 'center';
  let radialX = 50, radialY = 50;
  let stopSegments = segments;

  const first = segments[0];
  const firstIsColor = !!parseCssColorToken(first.split(/\s+/)[0]);

  if (!firstIsColor) {
    if (type === 'linear') {
      const degMatch = first.match(/^(-?[\d.]+)deg$/i);
      const keywordMap: Record<string, number> = {
        top: 0, right: 90, bottom: 180, left: 270,
        'top right': 45, 'right top': 45, 'bottom right': 135, 'right bottom': 135,
        'bottom left': 225, 'left bottom': 225, 'top left': 315, 'left top': 315
      };
      const toMatch = first.match(/^to\s+([a-z\s]+)$/i);
      if (degMatch) angle = Number(degMatch[1]);
      else if (toMatch) angle = keywordMap[toMatch[1].trim().toLowerCase().replace(/\s+/g, ' ')] ?? 135;
      stopSegments = segments.slice(1);
    } else {
      if (/ellipse/i.test(first)) radialShape = 'ellipse';
      if (type === 'conic') {
        const fromMatch = first.match(/from\s+(-?[\d.]+)deg/i);
        if (fromMatch) angle = Number(fromMatch[1]);
      }
      const atPctMatch = first.match(/at\s+([\d.]+)%\s+([\d.]+)%/i);
      const atKeywordMatch = first.match(/at\s+([a-z\s]+)$/i);
      if (atPctMatch) {
        radialPosition = 'custom';
        radialX = Number(atPctMatch[1]);
        radialY = Number(atPctMatch[2]);
      } else if (atKeywordMatch) {
        const kw = atKeywordMatch[1].trim().toLowerCase().replace(/\s+/g, ' ');
        if (POSITION_KEYWORD_MAP[kw]) {
          radialPosition = kw;
          [radialX, radialY] = POSITION_KEYWORD_MAP[kw];
        }
      }
      stopSegments = segments.slice(1);
    }
  }

  if (stopSegments.length === 0) return null;

  const parsedStops = stopSegments.map((seg, i) => {
    const tokens = seg.trim().split(/\s+/);
    const pctToken = tokens.find(t => /^[\d.]+%$/.test(t));
    const colorTokens = tokens.filter(t => t !== pctToken);
    const parsedColor = parseCssColorToken(colorTokens.join(' '));
    return {
      id: `imp-${i}-${Math.random().toString(36).slice(2, 8)}`,
      color: parsedColor?.hex || '#888888',
      opacity: parsedColor?.opacity ?? 100,
      stop: pctToken ? Number(pctToken.replace('%', '')) : Math.round((i / Math.max(stopSegments.length - 1, 1)) * 100)
    };
  });

  return { type, angle, radialShape, radialPosition, radialX, radialY, stops: parsedStops };
}

export default function GradientGenerator() {
  const [stops, setStops] = useState<ColorStop[]>([
    { id: '1', color: '#6366f1', stop: 0, opacity: 100 },
    { id: '2', color: '#ec4899', stop: 100, opacity: 100 }
  ]);
  const [gradientType, setGradientType] = useState<'linear' | 'radial' | 'conic' | 'mesh'>('linear');
  const [angle, setAngle] = useState<number>(135);
  const [radialShape, setRadialShape] = useState<'circle' | 'ellipse'>('circle');
  const [radialPosition, setRadialPosition] = useState<string>('center');
  const [radialX, setRadialX] = useState<number>(50);
  const [radialY, setRadialY] = useState<number>(50);
  
  // Mesh points state
  const [meshPoints, setMeshPoints] = useState<MeshPoint[]>([
    { id: 'm1', color: '#6366f1', x: 20, y: 30, radius: 60 },
    { id: 'm2', color: '#ec4899', x: 80, y: 20, radius: 70 },
    { id: 'm3', color: '#3b82f6', x: 30, y: 80, radius: 65 },
    { id: 'm4', color: '#10b981', x: 85, y: 85, radius: 55 },
  ]);

  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<'full' | 'card' | 'text' | 'button' | 'phone' | 'badge'>('full');
  const [exportFormat, setExportFormat] = useState<'css' | 'tailwind' | 'svg' | 'react' | 'animated'>('css');
  const [presetCategory, setPresetCategory] = useState<string>('All');
  const [presetSearch, setPresetSearch] = useState<string>('');
  const [savedGradients, setSavedGradients] = useState<SavedGradient[]>([]);
  const [gradientName, setGradientName] = useState<string>('Custom Gradient');
  const [isSaved, setIsSaved] = useState(false);

  const [showImportBox, setShowImportBox] = useState(false);
  const [importCssText, setImportCssText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  // A ref (not state) so onPointerMove reads the current drag target synchronously —
  // setState-driven state would still show the pre-drag value on the first move event
  // fired immediately after pointerdown, dropping fast drags.
  const draggingStopIdRef = useRef<string | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const activeStopId = stops[0]?.id || '';
  const [selectedStopId, setSelectedStopId] = useState<string>(activeStopId);

  useEffect(() => {
    const localSaved = localStorage.getItem('util_hub_saved_gradients');
    if (localSaved) {
      try {
        setSavedGradients(JSON.parse(localSaved));
      } catch {
        // Fallback
      }
    }
  }, []);

  const sortedStops = [...stops].sort((a, b) => a.stop - b.stop);

  const hexToRgba = (hex: string, opacityPercent: number) => {
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
    const alpha = (opacityPercent / 100).toFixed(2);
    return opacityPercent < 100 ? `rgba(${r}, ${g}, ${b}, ${alpha})` : hex;
  };

  const getGradientString = () => {
    if (gradientType === 'mesh') {
      return meshPoints.map(p => `radial-gradient(circle at ${p.x}% ${p.y}%, ${p.color} 0%, transparent ${p.radius}%)`).join(', ');
    }

    const stopsStr = sortedStops.map(s => `${hexToRgba(s.color, s.opacity)} ${s.stop}%`).join(', ');
    if (gradientType === 'linear') {
      return `linear-gradient(${angle}deg, ${stopsStr})`;
    } else if (gradientType === 'radial') {
      const pos = radialPosition === 'custom' ? `${radialX}% ${radialY}%` : radialPosition;
      return `radial-gradient(${radialShape} at ${pos}, ${stopsStr})`;
    } else {
      const pos = radialPosition === 'custom' ? `${radialX}% ${radialY}%` : radialPosition;
      return `conic-gradient(from ${angle}deg at ${pos}, ${stopsStr})`;
    }
  };

  const getTailwindArbitraryValue = () => {
    if (gradientType === 'mesh') {
      return `/* Mesh gradient inline style recommended */`;
    }
    const stopsStr = sortedStops.map(s => `${s.color}_${s.stop}%`).join(',');
    const positionToken = radialPosition === 'custom' ? `${radialX}%_${radialY}%` : radialPosition.replace(/\s+/g, '_');
    if (gradientType === 'linear') {
      return `bg-[linear-gradient(${angle}deg,${stopsStr})]`;
    } else if (gradientType === 'radial') {
      return `bg-[radial-gradient(${radialShape}_at_${positionToken},${stopsStr})]`;
    } else {
      return `bg-[conic-gradient(from_${angle}deg_at_${positionToken},${stopsStr})]`;
    }
  };

  const getSvgCode = () => {
    const stopsXml = sortedStops.map(s =>
      `<stop offset="${s.stop}%" stop-color="${s.color}" stop-opacity="${s.opacity / 100}" />`
    ).join('\n      ');

    if (gradientType === 'mesh') {
      const defs = meshPoints.map((p, i) => `
    <radialGradient id="mesh${i}" cx="${p.x}%" cy="${p.y}%" r="${p.radius}%">
      <stop offset="0%" stop-color="${p.color}" stop-opacity="1" />
      <stop offset="100%" stop-color="${p.color}" stop-opacity="0" />
    </radialGradient>`).join('');
      const layers = meshPoints.map((_, i) => `  <rect width="100%" height="100%" fill="url(#mesh${i})" />`).join('\n');
      return `<svg width="100%" height="100%" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
  <defs>${defs}
  </defs>
  <rect width="100%" height="100%" fill="#0f172a" />
${layers}
</svg>`;
    }

    if (gradientType === 'linear') {
      const rad = (angle * Math.PI) / 180;
      const dx = Math.sin(rad), dy = -Math.cos(rad);
      const cx = 500, cy = 500, half = 500;
      const x1 = (cx - dx * half).toFixed(1), y1 = (cy - dy * half).toFixed(1);
      const x2 = (cx + dx * half).toFixed(1), y2 = (cy + dy * half).toFixed(1);
      return `<svg width="100%" height="100%" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gradient" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
      ${stopsXml}
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#gradient)" />
</svg>`;
    }

    if (gradientType === 'radial') {
      const [pxPct, pyPct] = radialPosition === 'custom' ? [radialX, radialY] : (POSITION_KEYWORD_MAP[radialPosition] || [50, 50]);
      const cx = pxPct * 10, cy = pyPct * 10;
      const transform = radialShape === 'ellipse'
        ? ` gradientTransform="translate(${cx} ${cy}) scale(1.4 1) translate(${-cx} ${-cy})"`
        : '';
      return `<svg width="100%" height="100%" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="gradient" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="750"${transform}>
      ${stopsXml}
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#gradient)" />
</svg>`;
    }

    // SVG has no native conic-gradient element. A foreignObject with the real CSS
    // conic-gradient renders correctly in browsers, though not in non-browser SVG viewers.
    return `<svg width="100%" height="100%" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;background:${getGradientString()}"></div>
  </foreignObject>
</svg>`;
  };

  const getReactStyleCode = () => {
    return `const style = {\n  background: "${getGradientString()}"\n};`;
  };

  const getAnimatedCssCode = () => {
    return `@keyframes gradientFlow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.animated-gradient {
  background: ${getGradientString()};
  background-size: 200% 200%;
  animation: gradientFlow 8s ease infinite;
}`;
  };

  const handleUpdateColor = (id: string, color: string) => {
    setStops(stops.map(s => s.id === id ? { ...s, color } : s));
  };

  const handleUpdateStopValue = (id: string, stop: number) => {
    setStops(stops.map(s => s.id === id ? { ...s, stop: Math.min(Math.max(stop, 0), 100) } : s));
  };

  const handleUpdateOpacity = (id: string, opacity: number) => {
    setStops(stops.map(s => s.id === id ? { ...s, opacity: Math.min(Math.max(opacity, 0), 100) } : s));
  };

  const handleAddStop = () => {
    const defaultPosition = sortedStops.length > 0 
      ? Math.round(sortedStops.reduce((acc, current, index) => {
          if (index === sortedStops.length - 1) return acc;
          const next = sortedStops[index + 1];
          const diff = next.stop - current.stop;
          if (diff > 10) return (current.stop + next.stop) / 2;
          return acc;
        }, 50))
      : 50;

    const rgbColors = [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
    const hexColor = '#' + rgbColors.map(x => x.toString(16).padStart(2, '0')).join('');
    
    const newStop: ColorStop = {
      id: Math.random().toString(36).substring(2, 9),
      color: hexColor,
      stop: Math.min(Math.max(defaultPosition, 0), 100),
      opacity: 100
    };
    setStops([...stops, newStop]);
    setSelectedStopId(newStop.id);
  };

  const handleRemoveStop = (id: string) => {
    if (stops.length <= 2) return;
    const remaining = stops.filter(s => s.id !== id);
    setStops(remaining);
    if (selectedStopId === id) {
      setSelectedStopId(remaining[0].id);
    }
  };

  const handleReverse = () => {
    const reversedStops = stops.map(s => ({
      ...s,
      stop: 100 - s.stop
    }));
    setStops(reversedStops);
  };

  const handleDistributeEvenly = () => {
    const n = stops.length;
    const sorted = [...stops].sort((a, b) => a.stop - b.stop);
    const distributed = sorted.map((s, idx) => ({
      ...s,
      stop: Math.round((idx / (n - 1)) * 100)
    }));
    setStops(distributed);
  };

  const handleRandomize = () => {
    const hexChars = '0123456789ABCDEF';
    const randomizedColors = stops.map(s => {
      let color = '#';
      for (let i = 0; i < 6; i++) {
        color += hexChars[Math.floor(Math.random() * 16)];
      }
      return { ...s, color };
    });
    setStops(randomizedColors);
  };

  // Color Harmony Generator
  const generateHarmony = (type: 'analogous' | 'complementary' | 'triadic' | 'pastel') => {
    const baseColor = stops[0]?.color || '#6366f1';
    let cleanHex = baseColor.replace('#', '');
    if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(c => c + c).join('');
    
    const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 0;

    // Convert RGB to HSL
    const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
    const max = Math.max(rNorm, gNorm, bNorm), min = Math.min(rNorm, gNorm, bNorm);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
        case gNorm: h = (bNorm - rNorm) / d + 2; break;
        case bNorm: h = (rNorm - gNorm) / d + 4; break;
      }
      h /= 6;
    }

    let hDegrees = h * 360;
    let newColors: string[] = [];

    if (type === 'analogous') {
      newColors = [
        hslToHex(hDegrees - 30, s, l),
        hslToHex(hDegrees, s, l),
        hslToHex(hDegrees + 30, s, l)
      ];
    } else if (type === 'complementary') {
      newColors = [
        hslToHex(hDegrees, s, l),
        hslToHex(hDegrees + 180, s, l)
      ];
    } else if (type === 'triadic') {
      newColors = [
        hslToHex(hDegrees, s, l),
        hslToHex(hDegrees + 120, s, l),
        hslToHex(hDegrees + 240, s, l)
      ];
    } else if (type === 'pastel') {
      newColors = [
        hslToHex(hDegrees, 0.65, 0.85),
        hslToHex(hDegrees + 45, 0.65, 0.85),
        hslToHex(hDegrees + 90, 0.65, 0.85)
      ];
    }

    const generatedStops = newColors.map((c, i) => ({
      id: Math.random().toString(36).substring(2, 9),
      color: c,
      stop: Math.round((i / (newColors.length - 1)) * 100),
      opacity: 100
    }));

    setStops(generatedStops);
    setSelectedStopId(generatedStops[0].id);
  };

  const handleImportCss = () => {
    const parsed = parseGradientCss(importCssText);
    if (!parsed) {
      setImportError('Could not parse that as a linear-gradient(), radial-gradient(), or conic-gradient() value.');
      return;
    }
    setGradientType(parsed.type);
    setAngle(parsed.angle);
    setRadialShape(parsed.radialShape);
    setRadialPosition(parsed.radialPosition);
    setRadialX(parsed.radialX);
    setRadialY(parsed.radialY);
    setStops(parsed.stops);
    setSelectedStopId(parsed.stops[0].id);
    setGradientName('Imported Gradient');
    setImportError(null);
    setImportCssText('');
    setShowImportBox(false);
  };

  const handleLoadPreset = (preset: typeof PRESETS[0]) => {
    const mapped: ColorStop[] = preset.colors.map((c, i) => ({
      id: Math.random().toString(36).substring(2, 9),
      color: c,
      stop: preset.stops[i],
      opacity: 100
    }));
    setStops(mapped);
    setSelectedStopId(mapped[0].id);
    setGradientType(preset.type);
    setGradientName(preset.name);
  };

  const handleSaveGradient = () => {
    const newSave: SavedGradient = {
      id: Math.random().toString(36).substring(2, 9),
      name: gradientName || 'Custom Gradient',
      type: gradientType,
      angle,
      stops: [...stops],
      createdAt: Date.now()
    };
    const updated = [newSave, ...savedGradients];
    setSavedGradients(updated);
    localStorage.setItem('util_hub_saved_gradients', JSON.stringify(updated));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleDeleteSaved = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = savedGradients.filter(g => g.id !== id);
    setSavedGradients(filtered);
    localStorage.setItem('util_hub_saved_gradients', JSON.stringify(filtered));
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const downloadAsPng = (width: number = 1920, height: number = 1080) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (gradientType === 'mesh') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      meshPoints.forEach(p => {
        const px = (p.x / 100) * width;
        const py = (p.y / 100) * height;
        const rad = (p.radius / 100) * Math.max(width, height);
        const grad = ctx.createRadialGradient(px, py, 0, px, py, rad);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      });
    } else {
      let fillStyle: CanvasGradient;

      if (gradientType === 'linear') {
        const angleRad = (angle * Math.PI) / 180;
        const r = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2)) / 2;
        const x1 = width / 2 - r * Math.cos(angleRad);
        const y1 = height / 2 - r * Math.sin(angleRad);
        const x2 = width / 2 + r * Math.cos(angleRad);
        const y2 = height / 2 + r * Math.sin(angleRad);
        fillStyle = ctx.createLinearGradient(x1, y1, x2, y2);
      } else {
        let px = width / 2;
        let py = height / 2;
        if (radialPosition.includes('top')) py = 0;
        if (radialPosition.includes('bottom')) py = height;
        if (radialPosition.includes('left')) px = 0;
        if (radialPosition.includes('right')) px = width;
        fillStyle = ctx.createRadialGradient(px, py, 10, px, py, Math.max(width, height));
      }

      sortedStops.forEach(s => {
        fillStyle.addColorStop(s.stop / 100, hexToRgba(s.color, s.opacity));
      });

      ctx.fillStyle = fillStyle;
      ctx.fillRect(0, 0, width, height);
    }

    const link = document.createElement('a');
    link.download = `gradient-${gradientName.toLowerCase().replace(/\s+/g, '-')}-${width}x${height}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredPresets = PRESETS.filter(p => {
    const matchesCategory = presetCategory === 'All' || p.category === presetCategory;
    const matchesSearch = p.name.toLowerCase().includes(presetSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = ['All', 'Vibrant', 'Pastels', 'Dark & Cyber', 'Brand Icons', 'Sunset & Nature', 'Aura Mesh'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-slate-900">
      
      {/* Control Pane */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
        
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-4 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-2xs">
              <Paintbrush className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={gradientName}
                  onChange={(e) => setGradientName(e.target.value)}
                  className="font-bold text-base text-slate-900 bg-transparent hover:bg-slate-50 focus:bg-white border border-transparent focus:border-slate-200 rounded px-1.5 py-0.5 outline-none tracking-tight transition-colors"
                  placeholder="Gradient Name"
                />
              </div>
              <p className="text-xs text-slate-500 font-medium px-1">Dynamic CSS & Tailwind Color Studio</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSaveGradient}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg cursor-pointer transition-colors shadow-2xs"
            >
              {isSaved ? <BookmarkCheck className="h-3.5 w-3.5 text-emerald-600" /> : <Bookmark className="h-3.5 w-3.5" />}
              <span>{isSaved ? 'Saved!' : 'Save Gradient'}</span>
            </button>
            
            <button
              onClick={() => { setShowImportBox(!showImportBox); setImportError(null); }}
              className={`p-2 rounded-lg cursor-pointer transition-colors ${
                showImportBox ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Import from CSS"
            >
              <Upload className="h-4 w-4" />
            </button>
            <button
              onClick={handleRandomize}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
              title="Randomize Swatches"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={handleReverse}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
              title="Reverse Order"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleDistributeEvenly}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
              title="Distribute Evenly"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Import from CSS bar */}
        {showImportBox && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">Paste a CSS gradient to import</label>
              <button
                onClick={() => { setShowImportBox(false); setImportError(null); }}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={importCssText}
                onChange={(e) => setImportCssText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleImportCss(); }}
                placeholder="linear-gradient(135deg, #6366f1 0%, #ec4899 100%)"
                className="flex-1 min-w-0 px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleImportCss}
                disabled={!importCssText.trim()}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-lg cursor-pointer shrink-0 transition-colors"
              >
                Load
              </button>
            </div>
            {importError && <p className="text-[11px] text-rose-600 font-medium">{importError}</p>}
          </div>
        )}

        {/* Gradient Mode selector */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">Gradient Type & Geometry</label>
          <div className="grid grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {(['linear', 'radial', 'conic', 'mesh'] as const).map(type => (
              <button
                key={type}
                onClick={() => setGradientType(type)}
                className={`py-2 text-xs font-semibold rounded-lg capitalize cursor-pointer transition-all ${
                  gradientType === type
                    ? 'bg-white shadow-2xs text-indigo-600 font-bold border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Controls per Type */}
        {gradientType === 'linear' && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">Rotation Angle</label>
              <span className="text-xs font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                {angle}°
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              value={angle}
              onChange={(e) => setAngle(Number(e.target.value))}
              className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
            <div className="flex items-center gap-1 pt-1 justify-between text-[11px] font-semibold text-slate-600">
              {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
                <button
                  key={a}
                  onClick={() => setAngle(a)}
                  className={`px-2 py-1 rounded border cursor-pointer transition-all ${
                    angle === a ? 'bg-indigo-600 text-white border-indigo-600 font-bold' : 'bg-white border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {a}°
                </button>
              ))}
            </div>
          </div>
        )}

        {gradientType === 'radial' && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Shape</label>
                <select
                  value={radialShape}
                  onChange={(e) => setRadialShape(e.target.value as any)}
                  className="w-full text-xs font-semibold rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-2xs focus:ring-2 focus:ring-indigo-600 outline-none"
                >
                  <option value="circle">Circle</option>
                  <option value="ellipse">Ellipse</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Center Position</label>
                <select
                  value={radialPosition}
                  onChange={(e) => setRadialPosition(e.target.value)}
                  className="w-full text-xs font-semibold rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-2xs focus:ring-2 focus:ring-indigo-600 outline-none"
                >
                  <option value="center">Center</option>
                  <option value="top">Top Center</option>
                  <option value="top left">Top Left</option>
                  <option value="top right">Top Right</option>
                  <option value="bottom">Bottom Center</option>
                  <option value="bottom left">Bottom Left</option>
                  <option value="bottom right">Bottom Right</option>
                  <option value="custom">Custom (X% / Y%)</option>
                </select>
              </div>
            </div>

            {radialPosition === 'custom' && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <span className="text-[11px] font-semibold text-slate-600 block">X Origin: {radialX}%</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={radialX}
                    onChange={(e) => setRadialX(Number(e.target.value))}
                    className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-600 block">Y Origin: {radialY}%</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={radialY}
                    onChange={(e) => setRadialY(Number(e.target.value))}
                    className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Color Harmony Synthesizer */}
        <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
              <Wand2 className="h-4 w-4 text-indigo-600" />
              <span>Color Harmony Synthesizer</span>
            </span>
            <span className="text-[10px] text-indigo-600 font-mono font-medium">1-Click Palettes</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <button
              onClick={() => generateHarmony('analogous')}
              className="py-1.5 px-2 bg-white hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-900 shadow-2xs cursor-pointer transition-colors"
            >
              Analogous
            </button>
            <button
              onClick={() => generateHarmony('complementary')}
              className="py-1.5 px-2 bg-white hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-900 shadow-2xs cursor-pointer transition-colors"
            >
              Complementary
            </button>
            <button
              onClick={() => generateHarmony('triadic')}
              className="py-1.5 px-2 bg-white hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-900 shadow-2xs cursor-pointer transition-colors"
            >
              Triadic
            </button>
            <button
              onClick={() => generateHarmony('pastel')}
              className="py-1.5 px-2 bg-white hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-900 shadow-2xs cursor-pointer transition-colors"
            >
              Soft Pastel
            </button>
          </div>
        </div>

        {/* Timeline Stops Visualizer */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Color Stops & Timeline
            </span>
            <button
              onClick={handleAddStop}
              className="inline-flex items-center gap-1 text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold px-3 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Color Stop</span>
            </button>
          </div>

          <div ref={trackRef} className="relative h-12 flex items-center bg-slate-100 rounded-xl px-4 border border-slate-200">
            <div
              className="absolute left-4 right-4 h-4 rounded-lg border border-slate-300 shadow-inner"
              style={{
                backgroundImage: `linear-gradient(90deg, ${sortedStops.map(s => `${hexToRgba(s.color, s.opacity)} ${s.stop}%`).join(', ')})`
              }}
            />
            {stops.map(s => (
              <button
                key={s.id}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setSelectedStopId(s.id);
                  draggingStopIdRef.current = s.id;
                }}
                onPointerMove={(e) => {
                  if (draggingStopIdRef.current !== s.id || !trackRef.current) return;
                  const rect = trackRef.current.getBoundingClientRect();
                  const pct = ((e.clientX - rect.left - 16) / (rect.width - 32)) * 100;
                  handleUpdateStopValue(s.id, Math.round(Math.min(Math.max(pct, 0), 100)));
                }}
                onPointerUp={() => { draggingStopIdRef.current = null; }}
                title={`Drag to reposition (${s.stop}%)`}
                className={`absolute w-6 h-6 rounded-full border-2 transform -translate-x-1/2 shadow-md cursor-grab active:cursor-grabbing touch-none select-none transition-transform ${
                  selectedStopId === s.id ? 'border-slate-900 scale-125 z-10 ring-2 ring-indigo-500' : 'border-white'
                }`}
                style={{
                  // `calc()` can't multiply two percentages together — ${s.stop}% * (100% - 2rem)
                  // is invalid CSS and the browser silently drops the whole declaration, which is
                  // why every stop used to collapse to the left edge. Multiplying by a plain
                  // unitless fraction keeps the expression valid.
                  left: `calc(1rem + (100% - 2rem) * ${s.stop / 100})`,
                  backgroundColor: s.color
                }}
              />
            ))}
          </div>
          <p className="text-[11px] text-slate-400">Drag a stop directly on the timeline, or fine-tune it below.</p>
        </div>

        {/* Selected Stop Modifier */}
        {stops.find(s => s.id === selectedStopId) && (() => {
          const activeStop = stops.find(s => s.id === selectedStopId)!;
          const swatches = ['#6366f1', '#ec4899', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6', '#d946ef', '#ffffff', '#000000'];

          return (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md border border-slate-300 shadow-2xs" style={{ backgroundColor: activeStop.color }} />
                  <span className="text-xs font-bold text-slate-900">Stop Controls ({activeStop.stop}%)</span>
                </div>
                <button
                  onClick={() => handleRemoveStop(activeStop.id)}
                  disabled={stops.length <= 2}
                  className="px-2.5 py-1 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Remove</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-slate-600 block">Color Value (Hex)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={activeStop.color}
                      onChange={(e) => handleUpdateColor(activeStop.id, e.target.value)}
                      className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer bg-white p-0.5 shrink-0"
                    />
                    <input
                      type="text"
                      value={activeStop.color.toUpperCase()}
                      onChange={(e) => handleUpdateColor(activeStop.id, e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded-lg outline-none uppercase shadow-2xs"
                    />
                  </div>
                  <div className="grid grid-cols-6 gap-1 pt-1">
                    {swatches.map(c => (
                      <button
                        key={c}
                        onClick={() => handleUpdateColor(activeStop.id, c)}
                        className="h-5 rounded border border-slate-200 hover:scale-105 cursor-pointer"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                      <span>Node Position</span>
                      <span>{activeStop.stop}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={activeStop.stop}
                      onChange={(e) => handleUpdateStopValue(activeStop.id, Number(e.target.value))}
                      className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                      <span>Alpha Opacity</span>
                      <span>{activeStop.opacity}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={activeStop.opacity}
                      onChange={(e) => handleUpdateOpacity(activeStop.id, Number(e.target.value))}
                      className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Export Formats */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Code & Asset Exporter
            </label>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              {(['css', 'tailwind', 'svg', 'react', 'animated'] as const).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setExportFormat(fmt)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md uppercase cursor-pointer transition-all ${
                    exportFormat === fmt ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-950 text-slate-100 rounded-xl p-4 font-mono text-xs border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800 text-[11px]">
              <span className="uppercase font-semibold text-indigo-400">{exportFormat} Output Snippet</span>
              <button
                onClick={() => {
                  const text = exportFormat === 'css' ? `background: ${getGradientString()};` :
                               exportFormat === 'tailwind' ? getTailwindArbitraryValue() :
                               exportFormat === 'svg' ? getSvgCode() :
                               exportFormat === 'react' ? getReactStyleCode() :
                               getAnimatedCssCode();
                  copyToClipboard(text, exportFormat);
                }}
                className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded border border-slate-700 cursor-pointer transition-colors"
              >
                {copiedType === exportFormat ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedType === exportFormat ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>

            <pre className="overflow-x-auto whitespace-pre-wrap text-emerald-300 leading-relaxed font-mono">
              {exportFormat === 'css' && `background: ${getGradientString()};`}
              {exportFormat === 'tailwind' && getTailwindArbitraryValue()}
              {exportFormat === 'svg' && getSvgCode()}
              {exportFormat === 'react' && getReactStyleCode()}
              {exportFormat === 'animated' && getAnimatedCssCode()}
            </pre>
          </div>
        </div>

      </div>

      {/* Visual Previews, Accessibility, and Presets Pane */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Interactive Sandbox card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="h-4 w-4 text-indigo-600" />
              <span>Live Mockup Sandbox</span>
            </span>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              {(['full', 'card', 'text', 'button', 'phone'] as const).map(style => (
                <button
                  key={style}
                  onClick={() => setPreviewTemplate(style)}
                  className={`px-2 py-0.5 text-xs font-semibold rounded capitalize cursor-pointer transition-all ${
                    previewTemplate === style
                      ? 'bg-white shadow-2xs text-indigo-600 font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          <div className="relative h-64 w-full rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center bg-slate-100">
            {previewTemplate === 'full' && (
              <div 
                className="absolute inset-0 h-full w-full transition-all duration-300"
                style={{ background: getGradientString() }}
              />
            )}

            {previewTemplate === 'card' && (
              <div className="w-4/5 shadow-xl bg-slate-950 overflow-hidden border border-slate-800 rounded-2xl flex flex-col justify-between">
                <div 
                  className="h-28 w-full relative"
                  style={{ background: getGradientString() }}
                />
                <div className="p-4 space-y-2 flex flex-col justify-end">
                  <div className="h-3 w-20 bg-indigo-500/80 rounded" />
                  <div className="h-2.5 w-full bg-slate-800 rounded" />
                </div>
              </div>
            )}

            {previewTemplate === 'text' && (
              <div className="text-center p-6 select-none bg-slate-950 border border-slate-800 rounded-2xl w-full h-full flex flex-col items-center justify-center">
                <h1 
                  className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent transform duration-150 hover:scale-105"
                  style={{ backgroundImage: getGradientString() }}
                >
                  Gradient Typography
                </h1>
                <p className="text-[11px] text-slate-400 font-mono font-medium uppercase tracking-wider mt-2">
                  CSS Background-Clip Text
                </p>
              </div>
            )}

            {previewTemplate === 'button' && (
              <div className="p-6 text-center">
                <button 
                  className="px-6 py-3 text-white font-bold text-sm rounded-xl shadow-lg transition-transform active:scale-95 hover:shadow-indigo-500/25 flex items-center gap-2 cursor-pointer"
                  style={{ background: getGradientString() }}
                >
                  <span>Action Button</span>
                  <MoveRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {previewTemplate === 'phone' && (
              <div className="w-44 h-56 bg-slate-950 rounded-3xl p-2 shadow-2xl border-2 border-slate-800 flex flex-col justify-between">
                <div className="w-12 h-2.5 bg-slate-800 rounded-full mx-auto" />
                <div 
                  className="h-40 w-full rounded-2xl flex items-center justify-center p-2 text-center text-white text-xs font-bold shadow-inner"
                  style={{ background: getGradientString() }}
                >
                  Mobile Screen
                </div>
                <div className="w-8 h-1 bg-slate-800 rounded-full mx-auto" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => downloadAsPng(1920, 1080)}
              className="flex items-center justify-center gap-1.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <FileDown className="h-3.5 w-3.5 text-indigo-400" />
              <span>Download PNG (1080p)</span>
            </button>
            <button
              onClick={() => downloadAsPng(3840, 2160)}
              className="flex items-center justify-center gap-1.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              <span>4K Wallpaper</span>
            </button>
          </div>
        </div>

        {/* Accessibility Contrast Checker */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-indigo-600" />
              <span>Text Contrast Check</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">WCAG 2.1</span>
          </div>

          {(() => {
            const avgHex = gradientType === 'mesh'
              ? averageHexColors(meshPoints.map(p => p.color))
              : computeAverageColor(sortedStops);
            const rows = [
              { label: 'White Text', textColor: '#ffffff', ratio: getContrastRatio(avgHex, '#ffffff') },
              { label: 'Black Text', textColor: '#000000', ratio: getContrastRatio(avgHex, '#000000') }
            ];

            return (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {rows.map(row => {
                    const rating = contrastRating(row.ratio);
                    return (
                      <div key={row.label} className="space-y-1.5">
                        <div
                          className="h-14 rounded-lg flex items-center justify-center text-sm font-bold shadow-inner border border-slate-200"
                          style={{ backgroundColor: avgHex, color: row.textColor }}
                        >
                          Aa Text
                        </div>
                        <div className="flex items-center justify-between text-[11px] gap-1">
                          <span className="font-semibold text-slate-600">{row.label}</span>
                          <span className={`inline-flex items-center gap-1 font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${
                            rating.level === 'AAA' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            rating.level === 'AA' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                            rating.level === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {rating.level === 'AAA' ? <CheckCircle2 className="h-3 w-3" /> :
                             rating.level === 'fail' ? <ShieldAlert className="h-3 w-3" /> :
                             <ShieldCheck className="h-3 w-3" />}
                            {row.ratio.toFixed(1)}:1
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Contrast ratio against this gradient's approximate dominant color (<span className="font-mono uppercase">{avgHex}</span>). Text placed over the lighter or darker end of the gradient may score differently — verify against the actual rendered background before shipping.
                </p>
              </>
            );
          })()}
        </div>

        {/* Saved Collection */}
        {savedGradients.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Bookmark className="h-4 w-4 text-indigo-600" />
                <span>My Saved Gradients ({savedGradients.length})</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 max-h-48 overflow-y-auto p-1">
              {savedGradients.map((saved) => (
                <div
                  key={saved.id}
                  onClick={() => {
                    setStops(saved.stops);
                    setSelectedStopId(saved.stops[0].id);
                    setGradientType(saved.type);
                    setAngle(saved.angle);
                    setGradientName(saved.name);
                  }}
                  className="group relative p-2.5 border border-slate-200 rounded-xl hover:border-indigo-400 bg-white cursor-pointer transition-all flex items-center justify-between shadow-2xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div 
                      className="w-7 h-7 rounded-lg shrink-0 border border-slate-200 shadow-2xs"
                      style={{
                        backgroundImage: `linear-gradient(135deg, ${saved.stops.map(s => s.color).join(', ')})`
                      }}
                    />
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {saved.name}
                      </h4>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 font-mono">
                        {saved.stops.length} Stops
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDeleteSaved(saved.id, e)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Color Palette Presets Catalog */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-indigo-600" />
              <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Presets Gallery
              </span>
            </div>
            
            <div className="relative w-36">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
              <input
                type="text"
                value={presetSearch}
                onChange={(e) => setPresetSearch(e.target.value)}
                placeholder="Filter..."
                className="w-full pl-6 pr-2 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 bg-slate-50 outline-none focus:bg-white focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-semibold text-slate-600">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setPresetCategory(cat)}
                className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap cursor-pointer ${
                  presetCategory === cat ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2.5 max-h-72 overflow-y-auto">
            {filteredPresets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handleLoadPreset(preset)}
                className="group relative p-2.5 border border-slate-200 rounded-xl hover:border-indigo-400 bg-white cursor-pointer transition-all flex items-center gap-2.5 text-left shadow-2xs"
              >
                <div 
                  className="w-8 h-8 rounded-lg shrink-0 border border-slate-200 shadow-2xs group-hover:scale-105 transition-transform"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${preset.colors.join(', ')})`
                  }}
                />
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                    {preset.name}
                  </h4>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 font-mono">
                    {preset.category}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
