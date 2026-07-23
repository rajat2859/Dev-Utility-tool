import React, { useState, useRef } from 'react';
import { Copy, Check, RefreshCw, Plus, Trash2, ArrowRightLeft, LayoutGrid, FileDown, Layers, MoveRight, Paintbrush } from 'lucide-react';

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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-zinc-900">
      
      {/* Control Pane */}
      <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl p-6 shadow-xs space-y-6">
        
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-zinc-100 text-zinc-900 rounded-md">
              <Paintbrush className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">Gradient Studio</h2>
              <p className="text-xs text-zinc-500 font-medium">Dynamic CSS Color Synthesizer</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={handleRandomize}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 rounded-md hover:bg-zinc-100 cursor-pointer transition-colors"
              title="Randomize Swatches"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={handleReverse}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 rounded-md hover:bg-zinc-100 cursor-pointer transition-colors"
              title="Reverse Order"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleDistributeEvenly}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 rounded-md hover:bg-zinc-100 cursor-pointer transition-colors"
              title="Distribute Evenly"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Configuration sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500 block">Gradient Direction</label>
            <div className="grid grid-cols-3 gap-1 bg-zinc-100 p-1 rounded-md border border-zinc-200">
              {(['linear', 'radial', 'conic'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setGradientType(type)}
                  className={`py-1 text-xs font-medium rounded capitalize cursor-pointer transition-all ${
                    gradientType === type
                      ? 'bg-white shadow-xs text-zinc-900 font-semibold'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            {gradientType === 'linear' || gradientType === 'conic' ? (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-500 block">Rotation Angle</label>
                  <span className="text-xs font-mono font-semibold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                    {angle}°
                  </span>
                </div>
                <div className="flex gap-4 items-center pt-1">
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={angle}
                    onChange={(e) => setAngle(Number(e.target.value))}
                    className="w-full accent-zinc-900 h-1.5 bg-zinc-100 rounded-lg cursor-pointer"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-500 block">Position Origin</label>
                  <span className="text-xs font-mono font-semibold text-zinc-900 capitalize bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                    {radialShape}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={radialShape}
                    onChange={(e) => setRadialShape(e.target.value as any)}
                    className="text-xs font-medium rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-zinc-900 focus:ring-1 focus:ring-zinc-950 shadow-xs"
                  >
                    <option value="circle">Circle</option>
                    <option value="ellipse">Ellipse</option>
                  </select>
                  <select
                    value={radialPosition}
                    onChange={(e) => setRadialPosition(e.target.value)}
                    className="text-xs font-medium rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-zinc-900 focus:ring-1 focus:ring-zinc-950 shadow-xs"
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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">
              Color Stops Timeline
            </span>
            <button
              onClick={handleAddStop}
              className="inline-flex items-center gap-1 text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-50 font-medium px-2.5 py-1 rounded-md shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              <span>Add Stop</span>
            </button>
          </div>

          <div className="relative h-10 flex items-center bg-zinc-50 rounded-lg px-4 border border-zinc-200">
            <div 
              className="absolute left-4 right-4 h-3.5 rounded-md border border-zinc-200"
              style={{
                backgroundImage: `linear-gradient(90deg, ${sortedStops.map(s => `${s.color} ${s.stop}%`).join(', ')})`
              }}
            />
            {stops.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedStopId(s.id)}
                className={`absolute w-5 h-5 rounded-full border-2 transform -translate-x-1/2 shadow-xs cursor-pointer active:scale-110 transition-transform ${
                  selectedStopId === s.id ? 'border-zinc-900 scale-125 z-10' : 'border-white'
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
            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 bg-zinc-200 text-zinc-900 rounded flex items-center justify-center">
                    <Paintbrush className="h-3 w-3" />
                  </div>
                  <h3 className="text-xs font-semibold text-zinc-900">Stop Modifier</h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs bg-white px-2 py-0.5 rounded text-zinc-600 font-mono border border-zinc-200">
                    Active Stop ({activeStop.stop}%)
                  </span>
                  
                  <button
                    onClick={() => handleRemoveStop(activeStop.id)}
                    disabled={stops.length <= 2}
                    className="p-1 px-2 border border-zinc-200 hover:border-rose-500 text-zinc-600 hover:text-rose-600 rounded bg-white hover:bg-rose-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs font-medium flex items-center gap-1"
                    title="Remove Selected Stop"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                
                {/* Palette Selector & Manual Input */}
                <div className="md:col-span-7 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-md border border-zinc-200 flex items-center justify-center overflow-hidden shadow-xs cursor-pointer bg-white">
                        <input
                          type="color"
                          value={activeStop.color}
                          onChange={(e) => handleUpdateColor(activeStop.id, e.target.value)}
                          className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer opacity-0"
                        />
                        <div className="w-7 h-7 rounded shadow-xs pointer-events-none" style={{ backgroundColor: activeStop.color }} />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <label className="text-[11px] font-medium text-zinc-500 block mb-1">Color Value (Hex)</label>
                      <div className="relative flex items-center">
                        <span className="absolute left-2.5 text-xs font-mono font-medium text-zinc-400">#</span>
                        <input
                          type="text"
                          value={activeStop.color.replace('#', '').toUpperCase()}
                          onChange={(e) => {
                            const val = e.target.value;
                            const cleanHex = val.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                            const updatedColor = '#' + cleanHex;
                            handleUpdateColor(activeStop.id, updatedColor.length >= 4 ? updatedColor : activeStop.color);
                          }}
                          className="w-full pl-6 pr-3 py-1 text-xs font-mono font-semibold text-zinc-900 bg-white border border-zinc-200 rounded-md focus:ring-1 focus:ring-zinc-950 outline-none uppercase shadow-xs"
                          placeholder="HEX"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-zinc-500 block mb-1">Preset Swatches</label>
                    <div className="grid grid-cols-7 gap-1.5 p-1 bg-white border border-zinc-200 rounded-md">
                      {miniSwatches.map((color) => (
                        <button
                          key={color}
                          onClick={() => handleUpdateColor(activeStop.id, color)}
                          className={`h-5 rounded hover:scale-105 active:scale-95 transition-all cursor-pointer border relative flex items-center justify-center ${
                            activeStop.color.toLowerCase() === color.toLowerCase()
                              ? 'border-zinc-900 ring-1 ring-zinc-950 z-10'
                              : 'border-zinc-200'
                          }`}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Placement Node Positioning */}
                <div className="md:col-span-5 space-y-2.5">
                  <div className="flex justify-between text-xs font-medium text-zinc-600">
                    <span>Node Position</span>
                    <span className="font-mono bg-white px-2 py-0.5 rounded text-zinc-900 border border-zinc-200">{activeStop.stop}%</span>
                  </div>
                  
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={activeStop.stop}
                    onChange={(e) => handleUpdateStopValue(activeStop.id, Number(e.target.value))}
                    className="w-full accent-zinc-900 h-1.5 bg-zinc-200 rounded-lg cursor-pointer"
                  />

                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-zinc-500 block">Snap Position</span>
                    <div className="grid grid-cols-5 gap-1">
                      {[0, 25, 50, 75, 100].map(pos => (
                        <button
                          key={pos}
                          onClick={() => handleUpdateStopValue(activeStop.id, pos)}
                          className={`py-0.5 text-xs font-medium rounded border cursor-pointer transition-all ${
                            activeStop.stop === pos
                              ? 'bg-zinc-900 border-zinc-900 text-zinc-50 shadow-xs'
                              : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100'
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
        <div className="space-y-2 pt-1">
          <label className="text-xs font-medium text-zinc-500 block">
            Code Output Exporters
          </label>
          <div className="space-y-2">
            <div className="bg-zinc-50 rounded-lg border border-zinc-200 px-3 py-2 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-medium text-zinc-500 block uppercase">CSS Rule Format</span>
                <code className="text-xs font-mono text-zinc-900 select-all truncate block">
                  background: {getGradientString()};
                </code>
              </div>
              <button
                onClick={() => copyToClipboard(`background: ${getGradientString()};`, 'css')}
                className="p-1.5 bg-white border border-zinc-200 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 rounded-md shadow-xs shrink-0 cursor-pointer transition-colors"
              >
                {copiedType === 'css' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>

            <div className="bg-zinc-50 rounded-lg border border-zinc-200 px-3 py-2 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-medium text-zinc-500 block uppercase">Tailwind CSS Format</span>
                <code className="text-xs font-mono text-zinc-900 select-all truncate block">
                  {getTailwindArbitraryValue()}
                </code>
              </div>
              <button
                onClick={() => copyToClipboard(getTailwindArbitraryValue(), 'tailwind')}
                className="p-1.5 bg-white border border-zinc-200 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 rounded-md shadow-xs shrink-0 cursor-pointer transition-colors"
              >
                {copiedType === 'tailwind' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Visual Previews and Presets Pane */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Interactive Sandbox card */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
              Live Preview Board
            </span>
            <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-md border border-zinc-200">
              {(['full', 'card', 'text', 'button'] as const).map(style => (
                <button
                  key={style}
                  onClick={() => setPreviewTemplate(style)}
                  className={`px-2 py-0.5 text-xs font-medium rounded capitalize cursor-pointer transition-all ${
                    previewTemplate === style
                      ? 'bg-white shadow-xs text-zinc-900 font-semibold'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          <div className="relative h-60 w-full rounded-lg overflow-hidden border border-zinc-200 flex items-center justify-center bg-zinc-100">
            {previewTemplate === 'full' && (
              <div 
                ref={previewRef}
                className="absolute inset-0 h-full w-full"
                style={{ background: getGradientString() }}
              />
            )}

            {previewTemplate === 'card' && (
              <div className="w-4/5 shadow-md bg-zinc-900 overflow-hidden border border-zinc-800 rounded-xl flex flex-col justify-between">
                <div 
                  className="h-24 w-full relative"
                  style={{ background: getGradientString() }}
                />
                <div className="p-3 space-y-1 flex flex-col justify-end">
                  <div className="h-2.5 w-16 bg-zinc-800 rounded" />
                  <div className="h-2 w-full bg-zinc-800/60 rounded" />
                </div>
              </div>
            )}

            {previewTemplate === 'text' && (
              <div className="text-center p-6 select-none bg-zinc-900 border border-zinc-800 rounded-xl w-full h-full flex flex-col items-center justify-center">
                <h1 
                  className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent transform duration-150 hover:scale-105"
                  style={{ backgroundImage: getGradientString() }}
                >
                  Spectacular Typography
                </h1>
                <p className="text-[11px] text-zinc-500 font-mono font-medium uppercase tracking-wider mt-2">
                  Gradient text clip
                </p>
              </div>
            )}

            {previewTemplate === 'button' && (
              <div className="p-6 text-center">
                <button 
                  className="px-5 py-2.5 text-white font-semibold text-xs rounded-md shadow-sm transition-transform active:scale-95 duration-100 hover:shadow flex items-center gap-2 cursor-pointer"
                  style={{ background: getGradientString() }}
                >
                  <span>Action Button</span>
                  <MoveRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          <button
            onClick={downloadAsPng}
            className="w-full flex items-center justify-center gap-2 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-50 rounded-md text-xs font-medium shadow-xs transition-colors cursor-pointer"
          >
            <FileDown className="h-3.5 w-3.5 text-zinc-300" />
            <span>Export High-Res PNG (1080p)</span>
          </button>
        </div>

        {/* Color Palette Presets Catalog Card */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-zinc-700" />
            <span className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
              Presets Gallery
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handleLoadPreset(preset)}
                className="group relative p-2.5 border border-zinc-200 rounded-lg hover:border-zinc-400 bg-white cursor-pointer transition-all flex items-center gap-2.5 text-left shadow-xs"
              >
                <div 
                  className="w-7 h-7 rounded shrink-0 border border-zinc-200"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${preset.colors.join(', ')})`
                  }}
                />
                <div className="min-w-0">
                  <h4 className="text-xs font-medium text-zinc-900 truncate group-hover:text-zinc-900">
                    {preset.name}
                  </h4>
                  <span className="text-[10px] uppercase font-medium text-zinc-400 font-mono">
                    {preset.colors.length} Colors
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
