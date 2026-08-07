import React, { useState, useMemo } from 'react';
import { ExternalLink, Play, Trash2, Sparkles, AlertCircle, CheckCircle2, Globe, ShieldAlert, Check, RefreshCw, Maximize2 } from 'lucide-react';

const MAX_URLS = 50;

export default function UrlOpener() {
  const [inputText, setInputText] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [openedUrls, setOpenedUrls] = useState<Record<string, boolean>>({});
  const [isLaunching, setIsLaunching] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const sampleUrls = [
    'https://google.com',
    'https://github.com',
    'https://wikipedia.org',
    'https://news.ycombinator.com',
    'https://producthunt.com'
  ];

  // Parse URLs into structured list
  const parsedUrls = useMemo(() => {
    if (!inputText.trim()) return [];

    const rawTokens = inputText
      .split(/[\n,\s]+/)
      .map((line) => line.trim())
      .filter(Boolean);

    const list: { id: string; raw: string; formatted: string; domain: string }[] = [];

    for (let i = 0; i < Math.min(rawTokens.length, MAX_URLS); i++) {
      const raw = rawTokens[i];
      let formatted = raw;
      if (!/^https?:\/\//i.test(formatted)) {
        formatted = 'https://' + formatted;
      }

      let domain = raw;
      try {
        domain = new URL(formatted).hostname;
      } catch {
        domain = raw;
      }

      list.push({
        id: `url-${i}-${formatted}`,
        raw,
        formatted,
        domain
      });
    }

    return list;
  }, [inputText]);

  const handleOpenSingle = (url: string, id: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    setOpenedUrls((prev) => ({ ...prev, [id]: true }));
  };

  const handleOpenAllUrls = async () => {
    if (parsedUrls.length === 0 || isLaunching) return;

    setIsLaunching(true);
    setProgress({ current: 0, total: parsedUrls.length });

    const newOpenedState = { ...openedUrls };
    let openedCount = 0;

    for (let i = 0; i < parsedUrls.length; i++) {
      const item = parsedUrls[i];
      
      // Attempt window.open
      const win = window.open(item.formatted, '_blank', 'noopener,noreferrer');
      if (win) {
        win.focus();
      } else {
        // Fallback anchor dispatch
        const a = document.createElement('a');
        a.href = item.formatted;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      openedCount++;
      newOpenedState[item.id] = true;
      setOpenedUrls({ ...newOpenedState });
      setProgress({ current: i + 1, total: parsedUrls.length });

      // Small 80ms stagger between tab requests to let browser process multiple windows smoothly
      if (i < parsedUrls.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    }

    setIsLaunching(false);
    setTimeout(() => setProgress(null), 3000);
    setStatusMessage(
      `Dispatched ${openedCount} URL tabs! If your browser opened only 1 tab, please click "Always Allow Popups" in your browser's address bar.`
    );
  };

  const handleOpenInNewWindow = () => {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  };

  const handleClear = () => {
    setInputText('');
    setOpenedUrls({});
    setStatusMessage(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 text-slate-900">
      {/* Tool Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-xs">
              <ExternalLink className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Multiple URL Opener
              </h2>
              <p className="text-xs text-slate-500">
                Paste up to 50 URLs below to open them in individual browser tabs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenInNewWindow}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 border border-indigo-200"
              title="Open app in a new tab for unconstrained popups"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span>Open App in New Tab</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setInputText(sampleUrls.join('\n'));
                setOpenedUrls({});
                setStatusMessage(null);
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              <span>Sample URLs</span>
            </button>
            {inputText && (
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 border border-rose-200"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Text Area */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label className="font-bold text-slate-700">Paste Web Addresses / URLs (One per line):</label>
            <span className={`font-mono font-bold ${parsedUrls.length >= MAX_URLS ? 'text-amber-600' : 'text-slate-500'}`}>
              {parsedUrls.length} / {MAX_URLS} max
            </span>
          </div>

          <textarea
            rows={8}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`https://example.com\nhttps://google.com\ngithub.com\nwikipedia.org`}
            className="w-full p-4 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:bg-white transition-all shadow-2xs leading-relaxed"
          />
        </div>

        {/* Browser Popup Blocker Tip */}
        <div className="p-3.5 bg-amber-50 border border-amber-200/90 rounded-xl text-xs text-amber-950 flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-950 block">Important Browser Requirement:</span>
            <p className="text-amber-900 leading-relaxed text-[11px]">
              Browsers block opening 2+ tabs simultaneously by default. When you click <strong>Open All URLs</strong>, look at your browser's address bar for a <strong>"Pop-up blocked"</strong> icon and select <strong>"Always allow pop-ups from this site"</strong>.
            </p>
          </div>
        </div>

        {progress && (
          <div className="p-3 bg-slate-900 text-white rounded-xl space-y-1.5">
            <div className="flex justify-between text-xs font-mono font-semibold">
              <span>Launching tabs into browser...</span>
              <span className="text-indigo-400">{progress.current} / {progress.total}</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-500 h-full transition-all duration-150"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {statusMessage && (
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Main Action Button */}
        <button
          type="button"
          onClick={handleOpenAllUrls}
          disabled={parsedUrls.length === 0 || isLaunching}
          className="w-full py-3.5 px-4 rounded-xl font-bold text-xs tracking-tight flex items-center justify-center gap-2 transition-all shadow-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLaunching ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin text-white" />
              <span>Launching Tabs ({progress?.current} / {progress?.total})...</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-white text-white" />
              <span>Open All {parsedUrls.length > 0 ? `(${parsedUrls.length})` : ''} URLs in Separate Tabs</span>
            </>
          )}
        </button>
      </div>

      {/* Individual Link List with Direct Tab Launch */}
      {parsedUrls.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-indigo-600" />
              <span>Parsed URLs Queue ({parsedUrls.length})</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">
              Click individual buttons if your browser blocked automatic multi-launch
            </span>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {parsedUrls.map((item, index) => {
              const isOpened = !!openedUrls[item.id];

              return (
                <div
                  key={item.id}
                  className={`p-3 text-xs flex items-center justify-between gap-3 transition-colors ${
                    isOpened ? 'bg-slate-50 text-slate-500' : 'bg-white hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-[10px] text-slate-400 font-bold w-5 shrink-0 text-right">
                      #{index + 1}
                    </span>
                    <a
                      href={item.formatted}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`font-mono text-xs truncate hover:underline ${
                        isOpened ? 'text-slate-400 line-through' : 'text-slate-900 font-semibold'
                      }`}
                    >
                      {item.formatted}
                    </a>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isOpened ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <Check className="h-3 w-3" /> Opened
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                        Pending
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenSingle(item.formatted, item.id)}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 cursor-pointer transition-colors flex items-center gap-1 text-[11px]"
                    >
                      <span>Open Tab</span>
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
