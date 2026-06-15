import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, RefreshCw, Sparkles, Plus, Trash2, ArrowRightLeft, LayoutGrid, FileDown, Layers, MoveRight, Paintbrush } from 'lucide-react';

interface ColorStop {
  id: string;
  color: string;
  stop: number;
}

const PRESETS = [
  { name: 'Hyper Light', colors: ['#ec4899', '#8b5cf6', '#3b82f6'], stops: [0, 50, 100], type: 'linear' as const },
  { name: 'Warm Sunset', colors: ['#f97316', '#ec4899', '#ef4444'], stops: [0, 50, 100], type: 'linear' as const },
  { name: 'Oceanic Breeze', colors: ['#06b6d4', '#3b82f6', '#1d4ed8'], stops: [0, 45, 100], type: 'linear' as const },
  { name: 'Emerald Forest', colors: ['#34d399', '#10b981', '#059669'], stops: [0, 60, 100], type: 'linear' as const },
  { name: 'Deep Space', colors: ['#0f172a', '#1e293b', '#475569'], stops: [0, 50, 100], type: 'linear' as const },
  { name: 'Neon Dream', colors: ['#ff007f', '#7f00ff', '#00f0ff'], stops: [0, 50, 100], type: 'linear' as const },
  { name: 'Aura Teal', colors: ['#4ade80', '#06b6d4', '#6366f1'], stops: [10, 55, 95], type: 'linear' as const },
  { name: 'Retro Sunset', colors: ['#facc15', '#f97316', '#dc2626'], stops: [0, 50, 100], type: 'linear' as const }
];

export default function GradientGenerator() {
  const [stops, setStops] = useState<ColorStop[]>([
    { id: '1', color: '#6366f1', stop: 0 },
    { id: '2', color: '#ec4899', stop: 100 }
  ]);
  const [gradientType, setGradientType] = useState<'linear' | 'radial' | 'conic'>('linear');
  const [angle, setAngle] = useState<number>(135);
  const [radialShape, setRadialShape] = useState<'circle' | 'ellipse'>('circle');
  const [radialPosition, setRadialPosition] = useState<string>('center');
  const [copiedType, setCopiedType] = useState<'css' | 'tailwind' | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<'full' | 'card' | 'text' | 'button'>('full');
  const previewRef = useRef<HTMLDivElement>(null);

  const activeStopId = stops[0]?.id || '';
  const [selectedStopId, setSelectedStopId] = useState<string>(activeStopId);

  const sortedStops = [...stops].sort((a, b) => a.stop - b.stop);

  const getGradientString = () => {
    const stopsStr = sortedStops.map(s => `${s.color} ${s.stop}%`).join(', ');
    if (gradientType === 'linear') {
      return `linear-gradient(${angle}deg, ${stopsStr})`;
    } else if (gradientType === 'radial') {
      return `radial-gradient(${radialShape} at ${radialPosition}, ${stopsStr})`;
    } else {
      return `conic-gradient(from ${angle}deg at ${radialPosition}, ${stopsStr})`;
    }
  };

  const getTailwindArbitraryValue = () => {
    const stopsStr = sortedStops.map(s => `${s.color}_${s.stop}%`).join(',');
    if (gradientType === 'linear') {
      return `bg-[linear-gradient(${angle}deg,${stopsStr})]`;
    } else if (gradientType === 'radial') {
      return `bg-[radial-gradient(${radialShape}_at_${radialPosition.replace(' ', '_')},${stopsStr})]`;
    } else {
      return `bg-[conic-gradient(from_${angle}deg_at_${radialPosition.replace(' ', '_')},${stopsStr})]`;
    }
  };

  const handleUpdateColor = (id: string, color: string) => {
    setStops(stops.map(s => s.id === id ? { ...s, color } : s));
  };

  const handleUpdateStopValue = (id: string, stop: number) => {
    setStops(stops.map(s => s.id === id ? { ...s, stop: Math.min(Math.max(stop, 0), 100) } : s));
  };

  const handleAddStop = () => {
    const defaultPosition = sortedStops.length > 0 
      ? Math.round(sortedStops.reduce((acc, current, index) => {
          if (index === sortedStops.length - 1) return acc;
          const next = sortedStops[index + 1];
          const diff = next.stop - current.stop;
          if (diff > 10) {
            return (current.stop + next.stop) / 2;
          }
          return acc;
        }, 50))
      : 50;

    const rgbColors = [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
    const hexColor = '#' + rgbColors.map(x => x.toString(16).padStart(2, '0')).join('');
    
    const newStop = {
      id: Math.random().toString(36).substring(2, 9),
      color: hexColor,
      stop: Math.min(Math.max(defaultPosition, 0), 100)
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

  const handleLoadPreset = (preset: typeof PRESETS[0]) => {
    const mapped = preset.colors.map((c, i) => ({
      id: Math.random().toString(36).substring(2, 9),
      color: c,
      stop: preset.stops[i]
    }));
    setStops(mapped);
    setSelectedStopId(mapped[0].id);
    setGradientType(preset.type);
  };

  const copyToClipboard = (text: string, type: 'css' | 'tailwind') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const downloadAsPng = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let fillStyle: CanvasGradient;

    if (gradientType === 'linear') {
      const angleRad = (angle * Math.PI) / 180;
      const r = Math.sqrt(Math.pow(1920, 2) + Math.pow(1080, 2)) / 2;
      const x1 = 1920 / 2 - r * Math.cos(angleRad);
      const y1 = 1080 / 2 - r * Math.sin(angleRad);
      const x2 = 1920 / 2 + r * Math.cos(angleRad);
      const y2 = 1080 / 2 + r * Math.sin(angleRad);
      fillStyle = ctx.createLinearGradient(x1, y1, x2, y2);
    } else {
      let px = 1920 / 2;
      let py = 1080 / 2;
      if (radialPosition.includes('top')) py = 0;
      if (radialPosition.includes('bottom')) py = 1080;
      if (radialPosition.includes('left')) px = 0;
      if (radialPosition.includes('right')) px = 1920;
      fillStyle = ctx.createRadialGradient(px, py, 10, px, py, 1920);
    }

    sortedStops.forEach(s => {
      fillStyle.addColorStop(s.stop / 100, s.color);
    });

    ctx.fillStyle = fillStyle;
    ctx.fillRect(0, 0, 1920, 1080);

    const link = document.createElement('a');
    link.download = 'gradient-custom.png';
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in text-slate-800 dark:text-slate-100">
      
      {/* Control Pane */}
      <div className="lg:col-span-7 bg-white dark:bg-elegant-card border border-slate-200/80 dark:border-elegant-border rounded-3xl p-6 md:p-8 shadow-xs space-y-6">
        
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-elegant-border/70 pb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Paintbrush className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">Gradient Studio</h1>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Dynamic CSS Stop Synthesizer</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleRandomize}
              className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 rounded-xl hover:bg-slate-50 dark:hover:bg-elegant-bg cursor-pointer transition-all"
              title="Randomize Harmonized Swatches"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={handleReverse}
              className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 rounded-xl hover:bg-slate-50 dark:hover:bg-elegant-bg cursor-pointer transition-all"
              title="Reverse Stops Order"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleDistributeEvenly}
              className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 rounded-xl hover:bg-slate-50 dark:hover:bg-elegant-bg cursor-pointer transition-all"
              title="Distribute Evenly"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Configuration sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest block">Gradient Direction Mode</label>
            <div className="grid grid-cols-3 gap-1 bg-slate-50 dark:bg-elegant-bg p-1 rounded-xl border border-slate-150 dark:border-elegant-border/80">
              {(['linear', 'radial', 'conic'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setGradientType(type)}
                  className={`py-1.5 text-xs font-bold rounded-lg capitalize cursor-pointer transition-all ${
                    gradientType === type
                      ? 'bg-white dark:bg-elegant-card shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-200/50 dark:border-elegant-border/30'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {gradientType === 'linear' || gradientType === 'conic' ? (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest block">Rotation Angle</label>
                  <span className="text-xs font-mono font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 px-2 py-0.5 rounded-md border border-indigo-100/50 dark:border-indigo-950/30">
                    {angle}°
                  </span>
                </div>
                <div className="flex gap-4 items-center">
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={angle}
                    onChange={(e) => setAngle(Number(e.target.value))}
                    className="w-full accent-indigo-550 h-1.5 bg-slate-100 dark:bg-elegant-bg rounded-lg cursor-pointer"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest block">Position Origin</label>
                  <span className="text-xs font-mono font-extrabold text-indigo-600 dark:text-indigo-400 capitalize bg-indigo-50/50 dark:bg-indigo-950/20 px-2 py-0.5 rounded-md border border-indigo-100/50 dark:border-indigo-950/30">
                    {radialShape}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={radialShape}
                    onChange={(e) => setRadialShape(e.target.value as any)}
                    className="text-xs font-semibold rounded-xl border border-slate-200 bg-white dark:bg-elegant-bg dark:border-elegant-border px-3 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="circle">Circle</option>
                    <option value="ellipse">Ellipse</option>
                  </select>
                  <select
                    value={radialPosition}
                    onChange={(e) => setRadialPosition(e.target.value)}
                    className="text-xs font-semibold rounded-xl border border-slate-200 bg-white dark:bg-elegant-bg dark:border-elegant-border px-3 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="center">Center</option>
                    <option value="top">Top</option>
                    <option value="top left">Top Left</option>
                    <option value="top right">Top Right</option>
                    <option value="bottom">Bottom</option>
                    <option value="bottom left">Bottom Left</option>
                    <option value="bottom right">Bottom Right</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Unified timeline stops visualizer & active slider */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest">
              Stops Array & Density Config
            </span>
            <button
              onClick={handleAddStop}
              className="flex items-center gap-1 text-[10px] bg-indigo-550 hover:bg-indigo-650 text-white font-extrabold px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              <span>Add Stop</span>
            </button>
          </div>

          <div className="relative h-10 flex items-center bg-slate-50/60 dark:bg-slate-900/40 rounded-xl px-4 border border-slate-150 dark:border-elegant-border/50">
            <div 
              className="absolute left-4 right-4 h-3.5 rounded-full shadow-inner border border-slate-200/50 dark:border-slate-800"
              style={{
                backgroundImage: `linear-gradient(90deg, ${sortedStops.map(s => `${s.color} ${s.stop}%`).join(', ')})`
              }}
            />
            {stops.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedStopId(s.id)}
                className={`absolute w-5 h-5 rounded-full border-2 transform -translate-x-1/2 shadow-xs cursor-pointer active:scale-110 transition-transform ${
                  selectedStopId === s.id ? 'border-indigo-600 scale-120 z-10' : 'border-white dark:border-slate-800'
                }`}
                style={{
                  left: `calc(1rem + ${s.stop}% * (100% - 2rem) / 100)`,
                  backgroundColor: s.color
                }}
              />
            ))}
          </div>
        </div>

        {/* Selected stop granular modifier card */}
        {stops.find(s => s.id === selectedStopId) && (() => {
          const activeStop = stops.find(s => s.id === selectedStopId)!;
          const miniSwatches = [
            '#6366f1', '#ec4899', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', 
            '#f97316', '#ef4444', '#f43f5e', '#8b5cf6', '#d946ef', '#475569',
            '#ffffff', '#000000'
          ];
          
          return (
            <div className="p-5 bg-slate-50 dark:bg-slate-900/40 border border-slate-150 dark:border-elegant-border rounded-2xl space-y-5 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-elegant-border/30 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-md flex items-center justify-center">
                    <Paintbrush className="h-3 w-3" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-neutral-100">Stop Modifier</h3>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Configure Gradient Node</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-[10px] bg-slate-100 dark:bg-elegant-bg px-2.5 py-1 rounded-md text-slate-500 dark:text-slate-405 font-mono font-bold border border-slate-200/50 dark:border-elegant-border/30">
                    Active Stop ({activeStop.stop}%)
                  </span>
                  
                  <button
                    onClick={() => handleRemoveStop(activeStop.id)}
                    disabled={stops.length <= 2}
                    className="p-1 px-2 border border-slate-200 hover:border-red-500 dark:border-elegant-border text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/25 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all text-[10px] font-bold flex items-center gap-1"
                    title="Remove Selected Stop"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                
                {/* Palette Selector & Manual Input */}
                <div className="md:col-span-7 space-y-3.5">
                  <div className="flex items-center gap-3">
                    {/* Native Picker Wrapper */}
                    <div className="relative group shrink-0">
                      <div className="absolute inset-0 rounded-xl bg-slate-200 dark:bg-slate-800 opacity-20 group-hover:scale-105 transition-transform" />
                      {/* Checkerboard bg underneath */}
                      <div className="w-12 h-12 rounded-xl bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:8px_8px] border border-slate-200 dark:border-elegant-border flex items-center justify-center overflow-hidden shadow-xs cursor-pointer">
                        <input
                          type="color"
                          value={activeStop.color}
                          onChange={(e) => handleUpdateColor(activeStop.id, e.target.value)}
                          className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer opacity-0"
                          id="color-picker-input"
                        />
                        <div className="w-9 h-9 rounded-lg shadow-sm transition-transform group-hover:scale-105 pointer-events-none" style={{ backgroundColor: activeStop.color }} />
                      </div>
                    </div>

                    {/* Text Inputs */}
                    <div className="flex-1 min-w-0">
                      <label htmlFor="stop-color-code" className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Color Value (Hex)</label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-xs font-mono font-bold text-slate-400 dark:text-slate-500">#</span>
                        <input
                          id="stop-color-code"
                          type="text"
                          value={activeStop.color.replace('#', '').toUpperCase()}
                          onChange={(e) => {
                            const val = e.target.value;
                            // Clean input to hex parts
                            const cleanHex = val.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                            const updatedColor = '#' + cleanHex;
                            handleUpdateColor(activeStop.id, updatedColor.length >= 4 ? updatedColor : activeStop.color);
                          }}
                          className="w-full pl-6 pr-3 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-neutral-100 bg-white dark:bg-elegant-bg border border-slate-200 dark:border-elegant-border rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none uppercase transition-all"
                          placeholder="HEX"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Curated Swatches Grid */}
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest block mb-1.5">Trendy Designer Swatches</label>
                    <div className="grid grid-cols-7 gap-1.5 p-1 bg-slate-100/50 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/60 rounded-xl">
                      {miniSwatches.map((color) => (
                        <button
                          key={color}
                          onClick={() => handleUpdateColor(activeStop.id, color)}
                          className={`h-6 rounded-md hover:scale-110 active:scale-95 transition-all shadow-xs cursor-pointer border relative flex items-center justify-center ${
                            activeStop.color.toLowerCase() === color.toLowerCase()
                              ? 'border-indigo-600 ring-2 ring-indigo-500/20 scale-105 z-10'
                              : 'border-slate-200/40 dark:border-slate-800'
                          }`}
                          style={{ backgroundColor: color }}
                          title={color}
                        >
                          {activeStop.color.toLowerCase() === color.toLowerCase() && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white mix-blend-difference" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Placement Node Positioning */}
                <div className="md:col-span-5 space-y-3">
                  <div className="flex justify-between text-[10px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest">
                    <span>Node Position</span>
                    <span className="font-mono bg-indigo-50 dark:bg-indigo-950/35 px-2 py-0.5 rounded-md text-indigo-600 dark:text-indigo-400">{activeStop.stop}%</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={activeStop.stop}
                      onChange={(e) => handleUpdateStopValue(activeStop.id, Number(e.target.value))}
                      className="w-full accent-indigo-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Quick Snap Alignment Presets */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Snap Stop To Origin</span>
                    <div className="grid grid-cols-5 gap-1">
                      {[0, 25, 50, 75, 100].map(pos => (
                        <button
                          key={pos}
                          onClick={() => handleUpdateStopValue(activeStop.id, pos)}
                          className={`py-1 text-[10px] font-bold rounded-lg border cursor-pointer transition-all ${
                            activeStop.stop === pos
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                              : 'bg-white dark:bg-elegant-bg border-slate-200 dark:border-elegant-border text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-elegant-card-hover hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          {pos}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

        {/* CSS Code Outputs card */}
        <div className="space-y-3 pt-2">
          <label className="text-xs font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest block font-sans">
            Code Output Exporters
          </label>
          <div className="space-y-2">
            <div className="bg-slate-50 dark:bg-elegant-bg rounded-xl border border-slate-150 dark:border-elegant-border px-4 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 block uppercase tracking-wider">CSS Rule Format</span>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 select-all truncate block">
                  background: {getGradientString()};
                </code>
              </div>
              <button
                onClick={() => copyToClipboard(`background: ${getGradientString()};`, 'css')}
                className="p-2 bg-white dark:bg-elegant-card border border-slate-250 dark:border-elegant-border/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-elegant-bg-hover rounded-xl shadow-xs shrink-0 cursor-pointer transition-colors"
              >
                {copiedType === 'css' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-elegant-bg rounded-xl border border-slate-150 dark:border-elegant-border px-4 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 block uppercase tracking-wider">Tailwind CSS Format</span>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 select-all truncate block">
                  {getTailwindArbitraryValue()}
                </code>
              </div>
              <button
                onClick={() => copyToClipboard(getTailwindArbitraryValue(), 'tailwind')}
                className="p-2 bg-white dark:bg-elegant-card border border-slate-250 dark:border-elegant-border/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-elegant-bg-hover rounded-xl shadow-xs shrink-0 cursor-pointer transition-colors"
              >
                {copiedType === 'tailwind' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Visual Previews and Presets Pane */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Interactive Sandbox card */}
        <div className="bg-white dark:bg-elegant-card border border-slate-200/80 dark:border-elegant-border rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest">
              Live Preview Board
            </span>
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-elegant-bg p-1 rounded-lg border border-slate-150 dark:border-elegant-border/50">
              {(['full', 'card', 'text', 'button'] as const).map(style => (
                <button
                  key={style}
                  onClick={() => setPreviewTemplate(style)}
                  className={`px-2 py-1 text-[10px] font-extrabold rounded-md uppercase cursor-pointer transition-all ${
                    previewTemplate === style
                      ? 'bg-white dark:bg-elegant-card shadow-xs text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-neutral-200'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          <div className="relative h-64 w-full rounded-2xl overflow-hidden border border-slate-150 dark:border-elegant-border flex items-center justify-center bg-slate-100/50">
            {previewTemplate === 'full' && (
              <div 
                ref={previewRef}
                className="absolute inset-0 h-full w-full"
                style={{ background: getGradientString() }}
              />
            )}

            {previewTemplate === 'card' && (
              <div className="w-4/5 shadow-lg bg-neutral-900 overflow-hidden border border-neutral-800 rounded-2xl flex flex-col justify-between">
                <div 
                  className="h-28 w-full relative"
                  style={{ background: getGradientString() }}
                />
                <div className="p-4 space-y-1.5 flex flex-col justify-end">
                  <div className="h-3 w-16 bg-neutral-800 rounded-md" />
                  <div className="h-2 w-full bg-neutral-800/60 rounded-md" />
                </div>
              </div>
            )}

            {previewTemplate === 'text' && (
              <div className="text-center p-6 select-none bg-slate-900 border border-slate-800/60 rounded-2xl w-full h-full flex flex-col items-center justify-center">
                <h1 
                  className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent transform duration-150 hover:scale-105"
                  style={{ backgroundImage: getGradientString() }}
                >
                  Spectacular Typography
                </h1>
                <p className="text-xs text-slate-500 font-mono font-semibold uppercase tracking-widest mt-2">
                  Clipping gradient pattern
                </p>
              </div>
            )}

            {previewTemplate === 'button' && (
              <div className="p-6 text-center">
                <button 
                  className="px-6 py-3 text-white font-extrabold text-sm rounded-xl tracking-tight shadow-md transition-transform active:scale-95 duration-100 hover:shadow-lg hover:brightness-105 flex items-center gap-2"
                  style={{ background: getGradientString() }}
                >
                  <span>Launcher Action</span>
                  <MoveRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <button
            onClick={downloadAsPng}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <FileDown className="h-4 w-4" />
            <span>Produce & Export High-Res PNG (1080p)</span>
          </button>
        </div>

        {/* Color Palette Presets Catalog Card */}
        <div className="bg-white dark:bg-elegant-card border border-slate-200/80 dark:border-elegant-border rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-1.5">
            <Layers className="h-4.5 w-4.5 text-indigo-500" />
            <span className="text-xs font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-widest">
              Gradients Gallery
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handleLoadPreset(preset)}
                className="group relative p-3 border border-slate-150 dark:border-elegant-border rounded-2xl hover:border-indigo-400 dark:hover:border-indigo-900 bg-white dark:bg-elegant-bg cursor-pointer transition-all flex items-center gap-3 text-left shadow-xs"
              >
                <div 
                  className="w-8 h-8 rounded-lg shrink-0"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${preset.colors.join(', ')})`
                  }}
                />
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-neutral-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {preset.name}
                  </h4>
                  <span className="text-[9px] uppercase font-bold text-slate-400 font-mono tracking-wider">
                    {preset.colors.length} Color Swatches
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
