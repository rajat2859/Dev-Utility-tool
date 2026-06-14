import React, { useState, useEffect } from 'react';
import { Clipboard, RefreshCw, Key, Binary, Hash, Check } from 'lucide-react';

export default function GeneratorTool() {
  const [subMode, setSubMode] = useState<'password' | 'uuid' | 'hex'>('password');
  
  const [passLength, setPassLength] = useState(16);
  const [useUpper, setUseUpper] = useState(true);
  const [useLower, setUseLower] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [password, setPassword] = useState('');
  const [passStrength, setPassStrength] = useState({ score: 0, text: 'Very Weak', color: 'bg-red-500' });

  const [uuidCount, setUuidCount] = useState(5);
  const [uuids, setUuids] = useState<string[]>([]);
  
  const [hexLength, setHexLength] = useState(32);
  const [hexResult, setHexResult] = useState('');

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  const generatePassword = () => {
    let chars = '';
    if (useUpper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (useLower) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (useNumbers) chars += '0123456789';
    if (useSymbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (!chars) {
      setPassword('Please select at least one character set');
      return;
    }

    let result = '';
    for (let i = 0; i < passLength; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      result += chars[randomIndex];
    }
    setPassword(result);
  };

  const calculateStrength = (pass: string) => {
    if (!pass || pass.includes('Please select')) {
      setPassStrength({ score: 0, text: 'N/A', color: 'bg-slate-300' });
      return;
    }
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (pass.length >= 14) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    let text = 'Weak';
    let color = 'bg-red-500';

    if (score <= 2) {
      text = 'Weak';
      color = 'bg-red-500';
    } else if (score === 3) {
      text = 'Medium';
      color = 'bg-amber-500';
    } else if (score === 4) {
      text = 'Strong';
      color = 'bg-emerald-500';
    } else {
      text = 'Very Strong';
      color = 'bg-indigo-600 dark:bg-indigo-400';
    }

    setPassStrength({ score, text, color });
  };

  const generateUuid = () => {
    const list: string[] = [];
    const count = Math.min(Math.max(uuidCount, 1), 50);
    for (let j = 0; j < count; j++) {
      list.push(uuidv4());
    }
    setUuids(list);
  };

  const uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const generateHex = () => {
    const size = Math.min(Math.max(hexLength, 2), 512);
    let result = '';
    const hexChars = '0123456789abcdef';
    for (let i = 0; i < size; i++) {
      result += hexChars[Math.floor(Math.random() * 16)];
    }
    setHexResult(result);
  };

  useEffect(() => {
    if (subMode === 'password') {
      generatePassword();
    } else if (subMode === 'uuid') {
      generateUuid();
    } else if (subMode === 'hex') {
      generateHex();
    }
  }, [subMode]);

  useEffect(() => {
    if (subMode === 'password') {
      generatePassword();
    }
  }, [passLength, useUpper, useLower, useNumbers, useSymbols]);

  useEffect(() => {
    if (subMode === 'password') {
      calculateStrength(password);
    }
  }, [password]);

  const handleCopySingle = (text: string, index?: number) => {
    navigator.clipboard.writeText(text);
    if (typeof index === 'number') {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } else {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  const handleCopyBulkUuids = () => {
    navigator.clipboard.writeText(uuids.join('\n'));
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4 border-slate-200 dark:border-elegant-border">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Secure Generators</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Produce robust passwords, UUIDs (v4), and random cryptographic byte strings instantly.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 dark:bg-elegant-sidebar rounded-xl max-w-md">
        <button
          onClick={() => setSubMode('password')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subMode === 'password'
              ? 'bg-white text-slate-800 shadow dark:bg-elegant-card-hover dark:text-white'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-880 dark:hover:text-slate-200'
          }`}
        >
          <Key className="h-3.5 w-3.5" />
          Password
        </button>
        <button
          onClick={() => setSubMode('uuid')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subMode === 'uuid'
              ? 'bg-white text-slate-800 shadow dark:bg-elegant-card-hover dark:text-white'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Binary className="h-3.5 w-3.5" />
          UUID v4
        </button>
        <button
          onClick={() => setSubMode('hex')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subMode === 'hex'
              ? 'bg-white text-slate-800 shadow dark:bg-elegant-card-hover dark:text-white'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Hash className="h-3.5 w-3.5" />
          Hex / Bytes
        </button>
      </div>

      {subMode === 'password' && (
        <div className="grid gap-6 md:grid-cols-5">
          <div className="md:col-span-3 space-y-5 bg-white dark:bg-elegant-card border border-slate-200 dark:border-elegant-border p-6 rounded-2xl shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Adjustment Settings</h3>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                <span>Character Length</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400">{passLength}</span>
              </div>
              <input
                type="range"
                min={6}
                max={64}
                value={passLength}
                onChange={(e) => setPassLength(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-elegant-sidebar rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-105 hover:bg-slate-50 dark:border-elegant-border dark:hover:bg-elegant-card-hover cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={useUpper}
                  onChange={(e) => setUseUpper(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600 h-4.5 w-4.5"
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Uppercase (A-Z)</span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 dark:border-elegant-border dark:hover:bg-elegant-card-hover cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={useLower}
                  onChange={(e) => setUseLower(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600 h-4.5 w-4.5"
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Lowercase (a-z)</span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 dark:border-elegant-border dark:hover:bg-elegant-card-hover cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={useNumbers}
                  onChange={(e) => setUseNumbers(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-505 accent-indigo-600 h-4.5 w-4.5"
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">Numbers (0-9)</span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 dark:border-elegant-border dark:hover:bg-elegant-card-hover cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={useSymbols}
                  onChange={(e) => setUseSymbols(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-505 accent-indigo-600 h-4.5 w-4.5"
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Symbols (%$#@)</span>
              </label>
            </div>
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className="h-full bg-slate-50 dark:bg-elegant-card border border-slate-205 dark:border-elegant-border p-6 rounded-2xl">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-505 uppercase tracking-wider block mb-3">Generated Password</span>
              <div className="relative flex items-center bg-white dark:bg-elegant-bg px-4 py-3.5 rounded-xl border border-slate-100 dark:border-elegant-border">
                <span className="text-sm font-mono text-slate-800 dark:text-slate-100 select-all break-all overflow-hidden max-w-[85%]">
                  {password}
                </span>
                <button
                  onClick={() => handleCopySingle(password)}
                  className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {copiedText ? <Check className="h-4 w-4 text-emerald-500" /> : <Clipboard className="h-4 w-4" />}
                </button>
              </div>

              <div className="mt-6 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Strength Assessment:</span>
                  <span className="font-semibold text-slate-700 dark:text-indigo-400">{passStrength.text}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-elegant-border rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`${passStrength.color} h-1.5 rounded-full transition-all duration-300`}
                    style={{ width: `${Math.max(passStrength.score * 20, 10)}%` }}
                  />
                </div>
              </div>

              <button
                onClick={generatePassword}
                className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 font-semibold text-white py-2.5 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Generate New
              </button>
            </div>
          </div>
        </div>
      )}

      {subMode === 'uuid' && (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-4 bg-white dark:bg-elegant-card border border-slate-205 dark:border-elegant-border p-6 rounded-2xl shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Batch Variables</h3>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-505 font-medium">Number of UUIDs to generate</label>
              <input
                type="number"
                min={1}
                max={50}
                value={uuidCount}
                onChange={(e) => setUuidCount(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 font-mono text-sm bg-white text-slate-800 focus:outline-none focus:border-indigo-505 dark:bg-elegant-bg dark:border-elegant-border dark:text-slate-100"
              />
              <span className="text-[10px] text-slate-400">Bulk output ranges from 1 to 50 UUIDs.</span>
            </div>

            <button
              onClick={generateUuid}
              className="w-full bg-indigo-600 hover:bg-indigo-700 font-medium text-white py-2.5 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Re-Generate Batch
            </button>
          </div>

          <div className="md:col-span-2 bg-slate-50 dark:bg-elegant-card border border-slate-200 dark:border-elegant-border p-6 rounded-2xl flex flex-col h-96">
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-505 uppercase tracking-wider">Bulk Log</span>
              {uuids.length > 0 && (
                <button
                  onClick={handleCopyBulkUuids}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:opacity-85 cursor-pointer flex items-center gap-1"
                >
                  {copiedText ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" />
                      <span>Copied Batch!</span>
                    </>
                  ) : (
                    <>
                      <Clipboard className="h-3 w-3" />
                      <span>Copy Entire Batch</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {uuids.map((val, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white dark:bg-elegant-bg px-3.5 py-2 rounded-xl border border-slate-100 dark:border-elegant-border font-mono text-xs select-all text-slate-700 dark:text-slate-300">
                  <span className="truncate">{val}</span>
                  <button
                    onClick={() => handleCopySingle(val, idx)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-205 cursor-pointer"
                  >
                    {copiedIndex === idx ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Clipboard className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {subMode === 'hex' && (
        <div className="grid gap-6 md:grid-cols-5">
          <div className="md:col-span-2 space-y-4 bg-white dark:bg-elegant-card border border-slate-250 dark:border-elegant-border p-6 rounded-2xl shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Hex Variables</h3>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Key length (tokens / digits)</span>
                <span className="font-mono text-indigo-600 font-bold">{hexLength}</span>
              </div>
              <input
                type="range"
                min={8}
                max={256}
                step={8}
                value={hexLength}
                onChange={(e) => setHexLength(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-elegant-sidebar rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <button
              onClick={generateHex}
              className="w-full bg-indigo-600 hover:bg-indigo-700 font-semibold text-white py-2.5 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate Hex
            </button>
          </div>

          <div className="md:col-span-3 bg-slate-50 dark:bg-elegant-card border border-slate-200 dark:border-elegant-border p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Hex String</span>
              <button
                onClick={() => handleCopySingle(hexResult)}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:opacity-85 cursor-pointer flex items-center gap-1"
              >
                {copiedText ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Clipboard className="h-3.5 w-3.5" />}
                <span>{copiedText ? 'Copied Key!' : 'Copy Key'}</span>
              </button>
            </div>

            <div className="bg-white dark:bg-elegant-bg p-4 rounded-xl border border-slate-105 dark:border-elegant-border font-mono text-sm break-all text-slate-700 dark:text-slate-300 select-all min-h-[140px] flex items-center">
              {hexResult}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
