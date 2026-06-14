import React, { useState, useEffect } from 'react';
import { Palette, Copy, Check, Info, ShieldAlert, Sparkles } from 'lucide-react';

export default function ColorUtility() {
  const [hex, setHex] = useState('#6366f1');
  const [rgb, setRgb] = useState('rgb(99, 102, 241)');
  const [hsl, setHsl] = useState('hsl(239, 84%, 67%)');

  const [contrastFore, setContrastFore] = useState('#ffffff');
  const [contrastBack, setContrastBack] = useState('#6366f1');
  const [contrastRatio, setContrastRatio] = useState(1);
  const [wcagAA_text, setWcagAA_text] = useState('Pass');
  const [wcagAAA_text, setWcagAAA_text] = useState('Pass');
  const [wcagAA_large, setWcagAA_large] = useState('Pass');
  const [wcagAAA_large, setWcagAAA_large] = useState('Pass');

  const [palette, setPalette] = useState<string[]>([]);
  const [copiedColor, setCopiedColor] = useState<string | null>(null);

  const hexToRgb = (h: string) => {
    let r = 0, g = 0, b = 0;
    h = h.replace(/^#/, '');
    if (h.length === 3) {
      r = parseInt(h[0] + h[0], 16);
      g = parseInt(h[1] + h[1], 16);
      b = parseInt(h[2] + h[2], 16);
    } else if (h.length === 6) {
      r = parseInt(h.substring(0, 2), 16);
      g = parseInt(h.substring(2, 4), 16);
      b = parseInt(h.substring(4, 6), 16);
    }
    return { r, g, b };
  };

  const rgbToHsl = (r: number, g: number, b: number) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  };

  const handleHexChange = (val: string) => {
    setHex(val);
    if (/^#[0-9A-F]{6}$/i.test(val) || /^#[0-9A-F]{3}$/i.test(val)) {
      const { r, g, b } = hexToRgb(val);
      setRgb(`rgb(${r}, ${g}, ${b})`);
      const { h, s, l } = rgbToHsl(r, g, b);
      setHsl(`hsl(${h}, ${s}%, ${l}%)`);
    }
  };

  const getLuminance = (r: number, g: number, b: number) => {
    const a = [r, g, b].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  };

  const calculateContrast = () => {
    try {
      if (!/^#[0-9A-F]{6}$/i.test(contrastFore) || !/^#[0-9A-F]{6}$/i.test(contrastBack)) {
        return;
      }
      const rgb1 = hexToRgb(contrastFore);
      const rgb2 = hexToRgb(contrastBack);

      const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
      const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

      const brightest = Math.max(lum1, lum2);
      const darkest = Math.min(lum1, lum2);

      const ratio = (brightest + 0.05) / (darkest + 0.05);
      const roundedRatio = Math.round(ratio * 100) / 100;
      setContrastRatio(roundedRatio);

      // WCAG 2.0 regulations
      setWcagAA_text(roundedRatio >= 4.5 ? 'PASS' : 'FAIL');
      setWcagAAA_text(roundedRatio >= 7 ? 'PASS' : 'FAIL');
      setWcagAA_large(roundedRatio >= 3 ? 'PASS' : 'FAIL');
      setWcagAAA_large(roundedRatio >= 4.5 ? 'PASS' : 'FAIL');
    } catch {
      // ignore
    }
  };

  const generateRandomPalette = () => {
    const colors = [];
    const baseHue = Math.floor(Math.random() * 360);
    for (let i = 0; i < 5; i++) {
      const h = (baseHue + i * 35) % 360;
      const s = 65 + Math.floor(Math.random() * 20);
      const l = 45 + Math.floor(Math.random() * 20);
      colors.push(hslToHex(h, s, l));
    }
    setPalette(colors);
  };

  const hslToHex = (h: number, s: number, l: number) => {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  useEffect(() => {
    calculateContrast();
  }, [contrastFore, contrastBack]);

  useEffect(() => {
    generateRandomPalette();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedColor(text);
    setTimeout(() => setCopiedColor(null), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4 border-slate-200 dark:border-elegant-border">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Design & Color Utilities</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Convert color spaces, check accessibility contrast ratios, and auto-generate harmonious palettes.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white dark:bg-elegant-card border border-slate-200 dark:border-elegant-border p-6 rounded-2xl shadow-sm space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-100">Color Format Converter</h3>
          <div className="flex items-center gap-4">
            <div
              className="h-20 w-20 rounded-xl shadow-inner border border-slate-100 dark:border-elegant-border shrink-0"
              style={{ backgroundColor: hex }}
            />
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-400 block">HEX Format</label>
                <input
                  type="text"
                  value={hex}
                  onChange={(e) => handleHexChange(e.target.value)}
                  placeholder="#6366f1"
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs dark:bg-elegant-bg dark:border-elegant-border dark:text-slate-200"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-slate-50 dark:bg-elegant-bg/40 p-3 rounded-lg border border-slate-100 dark:border-elegant-border">
              <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">RGB Code</span>
              <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-350">{rgb}</span>
            </div>
            <div className="bg-slate-50 dark:bg-elegant-bg/40 p-3 rounded-lg border border-slate-100 dark:border-elegant-border">
              <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">HSL Code</span>
              <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-350">{hsl}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-elegant-card border border-slate-200 dark:border-elegant-border p-6 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-850 dark:text-slate-100">Harmonious Palette Generator</h3>
            <button
              onClick={generateRandomPalette}
              className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:opacity-85 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Regenerate
            </button>
          </div>

          <div className="flex gap-2 h-24 pt-1">
            {palette.map((color, index) => (
              <div
                key={index}
                onClick={() => handleCopy(color)}
                className="flex-1 rounded-xl cursor-copy relative group overflow-hidden border border-slate-100 dark:border-elegant-border shadow-xs flex items-end justify-center pb-2.5 hover:-translate-y-1 hover:shadow-md transition-all"
                style={{ backgroundColor: color }}
              >
                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="text-[9px] font-mono font-bold bg-white/95 text-slate-850 px-1.5 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity uppercase">
                  {copiedColor === color ? 'Copied' : color}
                </span>
              </div>
            ))}
          </div>
          <span className="text-[10px] text-slate-400 block text-center mt-2">Hover and click any block to copy its hex value directly.</span>
        </div>
      </div>

      <div className="bg-white dark:bg-elegant-card border border-slate-200 dark:border-elegant-border p-6 rounded-2xl shadow-sm space-y-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-100">WCAG 2.0 Accessibility Contrast Checker</h3>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Foreground Color (Text)</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={contrastFore}
                  onChange={(e) => setContrastFore(e.target.value)}
                  className="h-9 w-9 p-0.5 bg-white dark:bg-elegant-bg rounded-lg border border-slate-200 dark:border-elegant-border cursor-pointer"
                />
                <input
                  type="text"
                  maxLength={7}
                  value={contrastFore}
                  onChange={(e) => setContrastFore(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs dark:bg-elegant-bg dark:border-elegant-border dark:text-slate-200"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Background Color (Canvas)</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={contrastBack}
                  onChange={(e) => setContrastBack(e.target.value)}
                  className="h-9 w-9 p-0.5 bg-white dark:bg-elegant-bg rounded-lg border border-slate-200 dark:border-elegant-border cursor-pointer"
                />
                <input
                  type="text"
                  maxLength={7}
                  value={contrastBack}
                  onChange={(e) => setContrastBack(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs dark:bg-elegant-bg dark:border-elegant-border dark:text-slate-200"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-5 bg-slate-50 dark:bg-elegant-bg/40 rounded-xl border border-slate-100 dark:border-elegant-border text-center">
            <span className="text-[10px] font-semibold text-slate-450 block uppercase tracking-wider">Contrast Ratio</span>
            <span className="text-4xl font-extrabold font-mono text-indigo-600 dark:text-indigo-400 mt-1">{contrastRatio} : 1</span>
            
            <div className="mt-3.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {contrastRatio >= 4.5 ? (
                <>
                  <Palette className="h-3.5 w-3.5" />
                  <span>Excellent Accessibility</span>
                </>
              ) : (
                <span className="text-amber-600 dark:text-amber-500 flex items-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Low contrast ratio
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="bg-slate-50 dark:bg-elegant-bg/40 p-3.5 rounded-xl border border-slate-100 dark:border-elegant-border">
              <span className="text-[10px] font-semibold text-slate-450 dark:text-slate-500 block">Normal Text AA</span>
              <span className={`text-base font-extrabold block mt-1 ${wcagAA_text === 'PASS' ? 'text-emerald-600' : 'text-red-500'}`}>
                {wcagAA_text}
              </span>
              <span className="text-[9px] text-slate-405 font-medium">Req ratio &gt;= 4.5</span>
            </div>
            
            <div className="bg-slate-50 dark:bg-elegant-bg/40 p-3.5 rounded-xl border border-slate-100 dark:border-elegant-border">
              <span className="text-[10px] font-semibold text-slate-450 dark:text-slate-500 block">Normal Text AAA</span>
              <span className={`text-base font-extrabold block mt-1 ${wcagAAA_text === 'PASS' ? 'text-emerald-600' : 'text-red-500'}`}>
                {wcagAAA_text}
              </span>
              <span className="text-[9px] text-slate-405 font-medium">Req ratio &gt;= 7.0</span>
            </div>

            <div className="bg-slate-50 dark:bg-elegant-bg/40 p-3.5 rounded-xl border border-slate-100 dark:border-elegant-border">
              <span className="text-[10px] font-semibold text-slate-450 dark:text-slate-500 block">Large Text AA</span>
              <span className={`text-base font-extrabold block mt-1 ${wcagAA_large === 'PASS' ? 'text-emerald-600' : 'text-red-500'}`}>
                {wcagAA_large}
              </span>
              <span className="text-[9px] text-slate-405 font-medium">Req ratio &gt;= 3.0</span>
            </div>

            <div className="bg-slate-50 dark:bg-elegant-bg/40 p-3.5 rounded-xl border border-slate-100 dark:border-elegant-border">
              <span className="text-[10px] font-semibold text-slate-450 dark:text-slate-500 block">Large Text AAA</span>
              <span className={`text-base font-extrabold block mt-1 ${wcagAAA_large === 'PASS' ? 'text-emerald-600' : 'text-red-500'}`}>
                {wcagAAA_large}
              </span>
              <span className="text-[9px] text-slate-405 font-medium">Req ratio &gt;= 4.5</span>
            </div>
          </div>
        </div>

        <div
          className="p-5 rounded-xl font-medium border text-center transition-all"
          style={{ color: contrastFore, backgroundColor: contrastBack, borderColor: contrastFore + '30' }}
        >
          <span className="text-xs uppercase tracking-widest block font-bold mb-1">Visual Preview Block</span>
          <span className="text-xl font-bold block mb-1">Testing Foreground Text Contrast</span>
          <span className="text-sm opacity-80 block">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.</span>
        </div>
      </div>
    </div>
  );
}
