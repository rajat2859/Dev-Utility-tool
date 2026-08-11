import React, { useState, useRef } from 'react';
import { 
  Globe, 
  FileImage, 
  AlertTriangle, 
  RefreshCw, 
  Copy, 
  Check, 
  FileSearch, 
  CheckSquare, 
  Link2, 
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileText,
  Layers
} from 'lucide-react';

interface SEOSection {
  titleMatches: boolean;
  expectedTitle: string;
  actualTitle: string;
  titleDifference: string;
  descriptionMatches: boolean;
  expectedDescription: string;
  actualDescription: string;
  descriptionDifference: string;
  status: 'match' | 'partial' | 'mismatch';
  analysis: string;
}

interface HeadingMatch {
  level: 'h1' | 'h2' | 'h3' | 'h4';
  expectedText: string;
  actualText: string;
  status: 'match' | 'partial' | 'mismatch';
  comment: string;
}

interface HeadingsSection {
  status: 'match' | 'partial' | 'mismatch';
  matches: HeadingMatch[];
  analysis: string;
}

interface BodyMismatch {
  category: string;
  expected: string;
  actual: string;
  severity: 'high' | 'medium' | 'low';
  comment: string;
}

interface BodyContentSection {
  status: 'match' | 'partial' | 'mismatch';
  mismatches: BodyMismatch[];
  matchesCount: number;
  mismatchesCount: number;
  analysis: string;
}

interface AnalysisReport {
  seo: SEOSection;
  headings: HeadingsSection;
  bodyContent: BodyContentSection;
  overallScore: number;
  summary: string;
  recommendations: string[];
}

export default function ContentChecker() {
  const [url, setUrl] = useState<string>('');
  const [rawHtml, setRawHtml] = useState<string>('');
  const [showHtmlPaste, setShowHtmlPaste] = useState<boolean>(false);

  // Screenshot QA states
  const [awesomeUrl, setAwesomeUrl] = useState<string>('');
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const [isResolvingAwesome, setIsResolvingAwesome] = useState<boolean>(false);
  const [awesomeError, setAwesomeError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (dataUrl: string, maxWidth = 1280, maxHeight = 1280, quality = 0.82): Promise<string> => {
    return new Promise((resolve) => {
      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        return resolve(dataUrl);
      }
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  React.useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              processFile(file);
              setError(null);
              setAwesomeError(null);
              break;
            }
          }
        }
      }
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, WebP).');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        const compressed = await compressImage(reader.result);
        setScreenshotBase64(compressed);
        setScreenshotPreview(compressed);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const resetScreenshot = () => {
    setScreenshotBase64(null);
    setScreenshotPreview(null);
    setAwesomeError(null);
  };

  const resolveAwesomeLink = async (targetAwesomeUrl?: string): Promise<string | null> => {
    const linkToResolve = targetAwesomeUrl || awesomeUrl;
    if (!linkToResolve.trim()) {
      setAwesomeError('Please enter a valid Awesome Screenshot share URL.');
      return null;
    }

    setIsResolvingAwesome(true);
    setAwesomeError(null);
    setError(null);

    try {
      const response = await fetch('/api/content-checker/resolve-awesome-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkToResolve.trim() })
      });

      const responseText = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(`Server returned status ${response.status}. Received non-JSON response format.`);
      }

      if (!response.ok) {
        throw new Error(data?.error || `Server error (${response.status}) while resolving Awesome Screenshot link.`);
      }

      if (data.success && data.base64) {
        const compressed = await compressImage(data.base64);
        setScreenshotBase64(compressed);
        setScreenshotPreview(compressed);
        return compressed;
      } else {
        throw new Error(data?.error || 'Failed to extract screenshot asset from Awesome Screenshot link.');
      }
    } catch (err: any) {
      const errMsg = err.message || 'Could not resolve screenshot from Awesome Screenshot link.';
      setAwesomeError(errMsg);
      return null;
    } finally {
      setIsResolvingAwesome(false);
    }
  };

  const runScreenshotAnalysis = async () => {
    if (!url.trim() && !rawHtml.trim()) {
      setError('Please enter a Target Webpage URL or paste HTML source code.');
      return;
    }

    let currentBase64 = screenshotBase64;

    if (!currentBase64 && awesomeUrl.trim()) {
      currentBase64 = await resolveAwesomeLink(awesomeUrl);
      if (!currentBase64) return;
    }

    if (!currentBase64) {
      setError('Please provide an Awesome Screenshot URL or upload a reference screenshot image.');
      return;
    }

    let sanitizedUrl = url.trim();
    if (sanitizedUrl && !/^https?:\/\//i.test(sanitizedUrl)) {
      sanitizedUrl = 'https://' + sanitizedUrl;
      setUrl(sanitizedUrl);
    }

    setIsLoading(true);
    setError(null);
    setReport(null);

    const steps = [
      'Connecting to target webpage & fetching HTML metadata...',
      'Resolving reference screenshot elements...',
      'Comparing expected specs with live webpage elements...',
      'Analyzing text copy and heading hierarchy...',
      'Compiling visual comparison report...'
    ];

    let currentStep = 0;
    setLoadingStep(steps[0]);
    const stepInterval = setInterval(() => {
      if (currentStep < steps.length - 1) {
        currentStep++;
        setLoadingStep(steps[currentStep]);
      }
    }, 1800);

    try {
      const finalImagePayload = await compressImage(currentBase64);

      let response = await fetch('/api/content-checker/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: sanitizedUrl || undefined,
          rawHtml: rawHtml.trim() || undefined,
          image: finalImagePayload
        })
      });

      let responseText = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(responseText);
      } catch {
        // ignore JSON parse error for initial try
      }

      // If server fetch failed for URL, attempt client-side proxy fetch fallback
      if ((!response.ok || !data?.success) && sanitizedUrl && !rawHtml.trim()) {
        console.warn("Backend URL fetch failed in Content Checker. Attempting client-side proxy fetch...");
        let fallbackHtml = "";

        try {
          const proxy1 = `https://api.allorigins.win/raw?url=${encodeURIComponent(sanitizedUrl)}`;
          const pRes1 = await fetch(proxy1);
          if (pRes1.ok) {
            const pText1 = await pRes1.text();
            if (pText1 && pText1.trim().length > 30) {
              fallbackHtml = pText1;
            }
          }
        } catch (e) {
          console.warn("Client proxy 1 failed:", e);
        }

        if (!fallbackHtml) {
          try {
            const proxy2 = `https://corsproxy.io/?${encodeURIComponent(sanitizedUrl)}`;
            const pRes2 = await fetch(proxy2);
            if (pRes2.ok) {
              const pText2 = await pRes2.text();
              if (pText2 && pText2.trim().length > 30) {
                fallbackHtml = pText2;
              }
            }
          } catch (e) {
            console.warn("Client proxy 2 failed:", e);
          }
        }

        if (fallbackHtml) {
          response = await fetch('/api/content-checker/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: sanitizedUrl,
              rawHtml: fallbackHtml,
              image: finalImagePayload
            })
          });
          responseText = await response.text();
          try {
            data = JSON.parse(responseText);
          } catch {
            data = null;
          }
        }
      }

      clearInterval(stepInterval);

      if (!response.ok || !data) {
        throw new Error(data?.error || `Server returned error status ${response.status}.`);
      }

      if (data.success) {
        setReport(data.report);
      } else {
        throw new Error(data?.error || 'Failed to complete analysis.');
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      setError(err.message || 'An unexpected error occurred while comparing webpage with screenshot.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-900">
      {/* Tool Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-purple-600 rounded-xl text-white shadow-xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Visual Copy & Screenshot Auditor
            </h2>
            <p className="text-xs text-slate-500">
              Audit live webpage content, copy accuracy, and heading structures against design reference screenshots.
            </p>
          </div>
        </div>
      </div>

      {/* Main Input Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        {/* Webpage Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-purple-600" />
              <span>Target Webpage URL</span>
            </label>
            <button
              type="button"
              onClick={() => setShowHtmlPaste(!showHtmlPaste)}
              className="text-[11px] text-purple-600 hover:underline font-semibold cursor-pointer"
            >
              {showHtmlPaste ? 'Switch to URL Input' : 'Or Paste Raw HTML Code'}
            </button>
          </div>

          {!showHtmlPaste ? (
            <div className="relative">
              <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="e.g. https://example.com/landing-page"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:bg-white shadow-2xs"
              />
            </div>
          ) : (
            <textarea
              rows={4}
              placeholder="Paste complete HTML source code here..."
              value={rawHtml}
              onChange={(e) => setRawHtml(e.target.value)}
              className="w-full p-3 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:bg-white shadow-2xs"
            />
          )}
        </div>

        {/* Screenshot / Reference Input */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Link2 className="h-4 w-4 text-sky-600" />
              <span>Awesome Screenshot Share URL</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. https://www.awesomescreenshot.com/image/..."
                value={awesomeUrl}
                onChange={(e) => setAwesomeUrl(e.target.value)}
                className="flex-1 px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:bg-white shadow-2xs"
              />
              <button
                type="button"
                onClick={() => resolveAwesomeLink()}
                disabled={isResolvingAwesome || !awesomeUrl.trim()}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded-xl shadow-2xs cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                {isResolvingAwesome ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <span>Fetch</span>}
              </button>
            </div>
            {awesomeError && <p className="text-[11px] text-rose-600 font-medium">{awesomeError}</p>}
          </div>

          {/* Screenshot Preview / Upload Dropzone */}
          {screenshotPreview ? (
            <div className="flex items-center justify-between p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl">
              <div className="flex items-center gap-3 min-w-0">
                <img src={screenshotPreview} alt="Reference" className="h-12 w-16 object-cover rounded-lg border border-emerald-200 shrink-0" />
                <span className="text-xs font-bold text-emerald-900 truncate">Reference Screenshot Loaded</span>
              </div>
              <button type="button" onClick={resetScreenshot} className="px-2 py-1 text-xs font-medium text-rose-700 bg-white border border-rose-200 rounded-lg cursor-pointer">
                Change
              </button>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors flex items-center justify-center gap-3 border-slate-200 bg-slate-50/50 hover:bg-slate-100/50"
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              <FileImage className="h-5 w-5 text-slate-400" />
              <span className="text-xs text-slate-600 font-medium">Or drag & drop screenshot file / paste from clipboard</span>
            </div>
          )}

          <button
            type="button"
            onClick={runScreenshotAnalysis}
            disabled={isLoading || (!url.trim() && !rawHtml.trim()) || (!awesomeUrl.trim() && !screenshotBase64)}
            className="w-full py-3 px-4 rounded-xl font-bold text-xs tracking-tight flex items-center justify-center gap-2 transition-all shadow-2xs bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-purple-200" />
                <span>{loadingStep || 'Comparing Webpage with Screenshot...'}</span>
              </>
            ) : (
              <>
                <FileSearch className="h-4 w-4 text-purple-200" />
                <span>Run Visual & Copy Audit</span>
              </>
            )}
          </button>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* SCREENSHOT REPORT RESULTS VIEW */}
      {report && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Visual Compliance Verdict</span>
              <p className="text-xs text-slate-700 font-medium leading-relaxed max-w-xl">{report.summary}</p>
            </div>
            <div className="text-center px-5 py-2.5 bg-slate-900 text-white rounded-xl shadow-xs shrink-0">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide block">Compliance Score</span>
              <span className={`text-3xl font-extrabold font-mono ${
                report.overallScore >= 80 ? 'text-emerald-400' : report.overallScore >= 50 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {report.overallScore}%
              </span>
            </div>
          </div>

          {/* SEO Match Section */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-600" /> Title & Description Verification
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                report.seo.status === 'match' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {report.seo.status.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{report.seo.analysis}</p>
          </div>

          {/* Headings Section */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Layers className="h-4 w-4 text-purple-600" /> Heading Hierarchy Match
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                report.headings.status === 'match' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {report.headings.status.toUpperCase()}
              </span>
            </div>
            <div className="space-y-2">
              {report.headings.matches.map((item, idx) => (
                <div key={idx} className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900 uppercase">{item.level}</span>
                    {item.status === 'match' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-amber-600" />
                    )}
                  </div>
                  <p className="text-slate-700 font-medium">{item.actualText || 'Missing in live page'}</p>
                  <p className="text-[11px] text-slate-500 italic">{item.comment}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">Actionable Copy Corrections:</h4>
            <div className="p-3 bg-purple-50/60 border border-purple-200/80 rounded-xl space-y-1 text-xs">
              {report.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 text-purple-950 font-medium">
                  <CheckSquare className="h-3.5 w-3.5 text-purple-600 shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
