import React, { useState, useEffect } from 'react';
import { Calendar, Clock, RefreshCw, Clipboard, Check, HelpCircle } from 'lucide-react';

export default function TimestampConverter() {
  const [currentEpoch, setCurrentEpoch] = useState(Math.floor(Date.now() / 1000));
  const [isLive, setIsLive] = useState(true);

  const [epochInput, setEpochInput] = useState(String(Math.floor(Date.now() / 1000)));
  const [epochResult, setEpochResult] = useState({ utc: '', local: '', relative: '' });

  const [humanYear, setHumanYear] = useState(new Date().getFullYear());
  const [humanMonth, setHumanMonth] = useState(new Date().getMonth() + 1);
  const [humanDay, setHumanDay] = useState(new Date().getDate());
  const [humanHour, setHumanHour] = useState(new Date().getHours());
  const [humanMin, setHumanMin] = useState(new Date().getMinutes());
  const [humanSec, setHumanSec] = useState(new Date().getSeconds());
  const [humanResult, setHumanResult] = useState('');

  const [copiedText, setCopiedText] = useState(false);
  const [copiedEpoch, setCopiedEpoch] = useState(false);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setCurrentEpoch(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isLive]);

  const handleConvertEpoch = () => {
    const rawVal = Number(epochInput.trim());
    if (isNaN(rawVal)) {
      setEpochResult({ utc: 'Invalid input', local: 'Invalid input', relative: 'Invalid input' });
      return;
    }

    // Guess seconds vs milliseconds
    const isMs = epochInput.trim().length > 11;
    const date = new Date(isMs ? rawVal : rawVal * 1000);

    if (isNaN(date.getTime())) {
      setEpochResult({ utc: 'Invalid date timeline', local: 'Invalid date timeline', relative: 'Invalid date timeline' });
      return;
    }

    const relativeStr = getRelativeTime(date);

    setEpochResult({
      utc: date.toUTCString(),
      local: date.toString(),
      relative: relativeStr,
    });
  };

  const handleConvertHuman = () => {
    try {
      const date = new Date(
        humanYear,
        humanMonth - 1,
        humanDay,
        humanHour,
        humanMin,
        humanSec
      );
      if (isNaN(date.getTime())) {
        setHumanResult('Invalid date metrics specified');
        return;
      }
      setHumanResult(String(Math.floor(date.getTime() / 1000)));
    } catch {
      setHumanResult('Conversion failed');
    }
  };

  const getRelativeTime = (date: Date) => {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const elapsed = date.getTime() - Date.now();
    const seconds = Math.round(elapsed / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (Math.abs(seconds) < 60) return rtf.format(seconds, 'second');
    if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
    if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
    return rtf.format(days, 'day');
  };

  useEffect(() => {
    handleConvertEpoch();
  }, [epochInput]);

  useEffect(() => {
    handleConvertHuman();
  }, [humanYear, humanMonth, humanDay, humanHour, humanMin, humanSec]);

  const handleCopy = (text: string, type: 'text' | 'epoch') => {
    navigator.clipboard.writeText(text);
    if (type === 'epoch') {
      setCopiedEpoch(true);
      setTimeout(() => setCopiedEpoch(false), 2000);
    } else {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  const handleImportCurrent = () => {
    setEpochInput(String(currentEpoch));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4 border-slate-200 dark:border-elegant-border">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Timestamp Converter</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Translate Unix epoch timestamp seconds into human-readable calendar dates and vice-versa.</p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-indigo-50 to-sky-50 dark:from-elegant-card dark:to-elegant-sidebar p-6 rounded-2xl border border-indigo-100/30 dark:border-elegant-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white dark:bg-elegant-bg rounded-xl shadow-sm text-indigo-600 dark:text-indigo-400">
            <Clock className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Current Unix Timestamp (seconds)</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold font-mono tracking-tight text-indigo-900 dark:text-indigo-100">{currentEpoch}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsLive(!isLive)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-sm border transition-all ${
              isLive
                ? 'bg-emerald-50 border-emerald-200/50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/20'
                : 'bg-slate-100 border-slate-200 text-slate-600 dark:bg-elegant-card-hover dark:border-elegant-border dark:text-slate-400'
            }`}
          >
            ● {isLive ? 'Live Update' : 'Paused'}
          </button>
          <button
            onClick={() => handleCopy(String(currentEpoch), 'epoch')}
            className="flex items-center gap-1 bg-white hover:bg-slate-50 active:bg-slate-100 dark:bg-elegant-bg text-slate-700 dark:text-slate-300 px-3 py-1.5 border border-slate-200 dark:border-elegant-border text-xs font-semibold rounded-lg shadow-sm cursor-pointer transition-colors"
          >
            {copiedEpoch ? <Check className="h-3 w-3 text-emerald-500" /> : <Clipboard className="h-3 w-3" />}
            Copy Current
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white dark:bg-elegant-card p-6 rounded-2xl border border-slate-200 dark:border-elegant-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-850 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-500" />
              Epoch to Human Date
            </h3>
            <button
              onClick={handleImportCurrent}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:opacity-85"
            >
              Paste Current
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-505">Unix Timestamp</label>
            <input
              type="text"
              value={epochInput}
              onChange={(e) => setEpochInput(e.target.value)}
              placeholder="e.g. 1718320000"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 font-mono text-sm bg-white text-slate-800 focus:outline-none focus:border-indigo-505 dark:bg-elegant-bg dark:border-elegant-border dark:text-slate-100"
            />
          </div>

          <div className="bg-slate-50 dark:bg-elegant-bg/40 p-4 rounded-xl border border-slate-100 dark:border-elegant-border space-y-3.5">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">GMT/UTC Timeline</span>
              <span className="text-xs sm:text-sm font-semibold font-mono text-slate-700 dark:text-slate-300">{epochResult.utc}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Local Timezone</span>
              <span className="text-xs sm:text-sm font-semibold font-mono text-slate-700 dark:text-slate-300">{epochResult.local}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Relative Timeline</span>
              <span className="text-xs sm:text-sm font-semibold font-mono text-indigo-600 dark:text-indigo-400 capitalize">{epochResult.relative}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-elegant-card p-6 rounded-2xl border border-slate-200 dark:border-elegant-border space-y-4">
          <h3 className="text-sm font-semibold text-slate-850 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-500" />
            Human Date to Epoch
          </h3>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400">Year</label>
              <input
                type="number"
                value={humanYear}
                onChange={(e) => setHumanYear(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-250 px-3 py-1.5 font-mono text-xs text-center dark:bg-elegant-bg dark:border-elegant-border"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400">Month</label>
              <input
                type="number"
                min={1}
                max={12}
                value={humanMonth}
                onChange={(e) => setHumanMonth(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-250 px-3 py-1.5 font-mono text-xs text-center dark:bg-elegant-bg dark:border-elegant-border"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400">Day</label>
              <input
                type="number"
                min={1}
                max={31}
                value={humanDay}
                onChange={(e) => setHumanDay(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-250 px-3 py-1.5 font-mono text-xs text-center dark:bg-elegant-bg dark:border-elegant-border"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400">Hr (24h)</label>
              <input
                type="number"
                min={0}
                max={23}
                value={humanHour}
                onChange={(e) => setHumanHour(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-250 px-3 py-1.5 font-mono text-xs text-center dark:bg-elegant-bg dark:border-elegant-border"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400">Min</label>
              <input
                type="number"
                min={0}
                max={59}
                value={humanMin}
                onChange={(e) => setHumanMin(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-250 px-3 py-1.5 font-mono text-xs text-center dark:bg-elegant-bg dark:border-elegant-border"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400">Sec</label>
              <input
                type="number"
                min={0}
                max={59}
                value={humanSec}
                onChange={(e) => setHumanSec(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-250 px-3 py-1.5 font-mono text-xs text-center dark:bg-elegant-bg dark:border-elegant-border"
              />
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-elegant-bg/40 p-4 rounded-xl border border-slate-100 dark:border-elegant-border flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Epoch Seconds output</span>
              <span className="text-lg font-bold font-mono text-slate-800 dark:text-slate-200">{humanResult}</span>
            </div>
            {humanResult && (
              <button
                onClick={() => handleCopy(humanResult, 'text')}
                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:opacity-85 cursor-pointer"
              >
                {copiedText ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Clipboard className="h-3.5 w-3.5" />}
                <span>Copy</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
