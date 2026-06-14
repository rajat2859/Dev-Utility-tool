import React, { useState, useEffect } from 'react';
import { Type, Clipboard, HelpCircle, Check, Sparkles } from 'lucide-react';

export default function TextAnalyzer() {
  const [text, setText] = useState('');
  const [stats, setStats] = useState({
    chars: 0,
    charsNoSpace: 0,
    words: 0,
    sentences: 0,
    paragraphs: 0,
    readingTime: 0,
  });

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const rawText = text || '';
    const cleanText = rawText.trim();
    
    const chars = rawText.length;
    const charsNoSpace = rawText.replace(/\s/g, '').length;
    
    const words = cleanText ? cleanText.split(/\s+/).filter(Boolean).length : 0;
    
    // Simple sentence regex
    const sentences = cleanText ? cleanText.split(/[.!?]+/).filter(Boolean).length : 0;
    
    const paragraphs = cleanText ? rawText.split('\n').filter(p => p.trim()).length : 0;
    
    // Average reading speed: 200 words per minute
    const readingTime = Math.ceil(words / 200);

    setStats({
      chars,
      charsNoSpace,
      words,
      sentences,
      paragraphs,
      readingTime,
    });
  }, [text]);

  const transformCase = (type: 'upper' | 'lower' | 'title' | 'sentence' | 'trim') => {
    if (!text) return;
    
    let result = '';
    if (type === 'upper') {
      result = text.toUpperCase();
    } else if (type === 'lower') {
      result = text.toLowerCase();
    } else if (type === 'title') {
      result = text.replace(/\b\w/g, c => c.toUpperCase());
    } else if (type === 'sentence') {
      result = text.toLowerCase().replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, boundary, char) => boundary + char.toUpperCase());
    } else if (type === 'trim') {
      result = text.trim().replace(/\s+/g, ' ');
    }
    
    setText(result);
  };

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadSample = () => {
    setText("The quick brown fox jumps over the lazy dog. A journey of a thousand miles begins with a single step. Technology is best when it brings people together. Everything should be made as simple as possible, but not simpler.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4 border-slate-200 dark:border-elegant-border">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Text Analyzer & Transformer</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Analyze counts, reading speeds, sentence structure, and convert casing styles in real-time.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSample}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 dark:bg-elegant-card dark:border-elegant-border dark:text-slate-300 dark:hover:bg-elegant-card-hover transition-colors cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            Load Sample Text
          </button>
          <button
            onClick={() => setText('')}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 dark:bg-elegant-card dark:border-elegant-border dark:text-slate-300 dark:hover:bg-elegant-card-hover transition-colors cursor-pointer"
          >
            Clear Text
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste your content block here. Statistics will populate immediately..."
            className="h-80 w-full rounded-2xl border border-slate-200 p-5 text-sm bg-white text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-elegant-card dark:border-elegant-border dark:text-slate-100 focus:outline-none resize-none leading-relaxed"
          />

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => transformCase('upper')}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-elegant-card-hover text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 cursor-pointer transition-colors"
            >
              UPPERCASE
            </button>
            <button
              onClick={() => transformCase('lower')}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-elegant-card-hover text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 cursor-pointer transition-colors"
            >
              lowercase
            </button>
            <button
              onClick={() => transformCase('title')}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-elegant-card-hover text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 cursor-pointer transition-colors"
            >
              Title Case
            </button>
            <button
              onClick={() => transformCase('sentence')}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-elegant-card-hover text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 cursor-pointer transition-colors"
            >
              Sentence case
            </button>
            <button
              onClick={() => transformCase('trim')}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-elegant-card-hover text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 cursor-pointer transition-colors"
            >
              Trim Extra Spaces
            </button>
            <div className="flex-1" />
            <button
              onClick={handleCopy}
              disabled={!text}
              className={`flex items-center gap-1 border px-3.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-all ${
                copied
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30'
                  : 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 shadow-sm disabled:opacity-50'
              }`}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy All'}
            </button>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-elegant-card border border-slate-200 dark:border-elegant-border p-6 rounded-2xl flex flex-col justify-between">
          <div className="space-y-4">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Metric Summary</span>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-elegant-bg p-4 rounded-xl border border-slate-100 dark:border-elegant-border shadow-xs">
                <span className="text-[10px] font-semibold text-slate-450 dark:text-slate-500 block">Characters</span>
                <span className="text-lg font-bold font-mono text-slate-800 dark:text-indigo-400">{stats.chars}</span>
              </div>
              <div className="bg-white dark:bg-elegant-bg p-4 rounded-xl border border-slate-100 dark:border-elegant-border shadow-xs">
                <span className="text-[10px] font-semibold text-slate-450 dark:text-slate-500 block">(No Spaces)</span>
                <span className="text-lg font-bold font-mono text-slate-800 dark:text-indigo-400">{stats.charsNoSpace}</span>
              </div>
              <div className="bg-white dark:bg-elegant-bg p-4 rounded-xl border border-slate-100 dark:border-elegant-border shadow-xs">
                <span className="text-[10px] font-semibold text-slate-450 dark:text-slate-500 block">Words</span>
                <span className="text-lg font-bold font-mono text-slate-800 dark:text-indigo-400">{stats.words}</span>
              </div>
              <div className="bg-white dark:bg-elegant-bg p-4 rounded-xl border border-slate-100 dark:border-elegant-border shadow-xs">
                <span className="text-[10px] font-semibold text-slate-450 dark:text-slate-500 block">Sentences</span>
                <span className="text-lg font-bold font-mono text-slate-800 dark:text-indigo-400">{stats.sentences}</span>
              </div>
              <div className="bg-white dark:bg-elegant-bg p-4 rounded-xl border border-slate-100 dark:border-elegant-border shadow-xs mb-2">
                <span className="text-[10px] font-semibold text-slate-450 dark:text-slate-500 block">Paragraphs</span>
                <span className="text-lg font-bold font-mono text-slate-800 dark:text-indigo-400">{stats.paragraphs}</span>
              </div>
              <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-100/35 dark:border-indigo-900/15 shadow-xs mb-2">
                <span className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 block">Reading Time</span>
                <span className="text-lg font-bold font-mono text-indigo-700 dark:text-indigo-300">~{stats.readingTime} min</span>
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t border-slate-200 dark:border-elegant-border text-[11px] text-slate-400 leading-relaxed flex items-center gap-1.5">
            <HelpCircle className="h-3.5 w-3.5 text-indigo-400" />
            <span>Assumes an average comprehension reading rate of 200 words-per-minute (WPM).</span>
          </div>
        </div>
      </div>
    </div>
  );
}
