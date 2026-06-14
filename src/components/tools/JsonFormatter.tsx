import React, { useState } from 'react';
import { AlignLeft, Braces, Clipboard, Code, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';

export default function JsonFormatter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [indent, setIndent] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const formatJson = () => {
    if (!input.trim()) {
      setError('Please enter some JSON first');
      setOutput('');
      return;
    }
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed, null, indent));
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Invalid JSON format');
      setOutput('');
    }
  };

  const minifyJson = () => {
    if (!input.trim()) {
      setError('Please enter some JSON first');
      setOutput('');
      return;
    }
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed));
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Invalid JSON format');
      setOutput('');
    }
  };

  const loadSample = () => {
    const sample = {
      name: "Utility Tool Suite",
      version: "1.0.0",
      active: true,
      features: [
        "JSON Formatting",
        "Base64 Encoding",
        "Password Generation",
        "Timestamp Conversion"
      ],
      metadata: {
        themeSupported: ["light", "dark"],
        speedMs: 0.12
      }
    };
    setInput(JSON.stringify(sample, null, 2));
    setError(null);
  };

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setInput('');
    setOutput('');
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4 border-slate-200 dark:border-elegant-border">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">JSON Formatter & Validator</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Validate, beautify, formatting or shrink complex JSON strings.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSample}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 dark:bg-elegant-card dark:border-elegant-border dark:text-slate-300 dark:hover:bg-elegant-card-hover transition-colors cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Load Sample
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 dark:bg-elegant-card dark:border-elegant-border dark:text-slate-300 dark:hover:bg-elegant-card-hover transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Input Raw JSON</label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 dark:text-slate-500">{input.length} characters</span>
            </div>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste your unformatted JSON here..."
            className="h-96 w-full rounded-xl border border-slate-200 p-4 font-mono text-sm bg-white text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-elegant-card dark:border-elegant-border dark:text-slate-100 focus:outline-none resize-none"
          />
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Tab size:</span>
              <select
                value={indent}
                onChange={(e) => setIndent(Number(e.target.value))}
                className="rounded border border-slate-200 px-2 py-1 text-xs bg-white dark:bg-elegant-card dark:border-elegant-border text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value={2}>2 spaces</option>
                <option value={4}>4 spaces</option>
                <option value={8}>8 spaces</option>
              </select>
            </div>
            <div className="flex-1" />
            <button
              onClick={minifyJson}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium border border-slate-200 dark:border-elegant-border text-slate-700 dark:text-slate-300 bg-white hover:bg-slate-50 active:bg-slate-100 dark:bg-elegant-card dark:hover:bg-elegant-card-hover transition-colors cursor-pointer"
            >
              <Code className="h-4 w-4 text-emerald-500" />
              Minify
            </button>
            <button
              onClick={formatJson}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-sm transition-colors cursor-pointer"
            >
              <Braces className="h-4 w-4" />
              Format & Validate
            </button>
          </div>
        </div>

        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Formatted JSON / Output</label>
            {output && (
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold shadow-sm transition-all cursor-pointer ${
                  copied
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'
                    : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 dark:hover:bg-indigo-900/30'
                }`}
              >
                <Clipboard className="h-3.5 w-3.5" />
                {copied ? 'Copied!' : 'Copy Result'}
              </button>
            )}
          </div>
          
          {error ? (
            <div className="flex h-96 w-full flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/50 p-6 text-center dark:border-red-900/30 dark:bg-red-950/10 dark:text-red-300">
              <AlertCircle className="mb-2 h-8 w-8 text-red-500 dark:text-red-400" />
              <h4 className="font-semibold text-red-800 dark:text-red-300">JSON Parse Error</h4>
              <p className="mt-1 font-mono text-xs text-red-600 dark:text-red-400/90 break-words max-w-md">
                {error}
              </p>
            </div>
          ) : output ? (
            <textarea
              readOnly
              value={output}
              className="h-96 w-full rounded-xl border border-slate-200 p-4 font-mono text-sm bg-slate-50 text-slate-800 dark:bg-elegant-bg dark:border-elegant-border dark:text-slate-100 focus:outline-none resize-none"
            />
          ) : (
            <div className="flex h-96 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/30 dark:border-elegant-border dark:bg-elegant-card/40">
              <AlignLeft className="h-8 w-8 text-slate-400 dark:text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-400 dark:text-slate-500">Output will appear here after formatting</p>
            </div>
          )}
          <div className="h-10" />
        </div>
      </div>
    </div>
  );
}
