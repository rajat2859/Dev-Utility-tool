import React, { useState, useRef } from 'react';
import { 
  Globe, 
  FileImage, 
  ArrowRight, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Info, 
  Sparkles, 
  RefreshCw, 
  Copy, 
  Check, 
  ExternalLink, 
  FileSearch, 
  Layers, 
  Sliders, 
  CheckSquare, 
  ArrowUpRight 
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
  level: 'h1' | 'h2' | 'h3';
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

interface WebpageData {
  title: string;
  description: string;
  headingsCount: number;
}

export default function ContentChecker() {
  const [url, setUrl] = useState<string>('');
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [webpageData, setWebpageData] = useState<WebpageData | null>(null);
  const [activeTab, setActiveTab] = useState<'seo' | 'headings' | 'body' | 'recommendations'>('seo');
  const [copied, setCopied] = useState<boolean>(false);

  // Awesome Screenshot & Paste states
  const [awesomeUrl, setAwesomeUrl] = useState<string>('');
  const [isResolvingAwesome, setIsResolvingAwesome] = useState<boolean>(false);
  const [awesomeError, setAwesomeError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global listener for pasting image files directly from clipboard
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

  // File Upload Handlers
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
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setScreenshotBase64(reader.result);
        setScreenshotPreview(reader.result);
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

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const resetScreenshot = () => {
    setScreenshotBase64(null);
    setScreenshotPreview(null);
    setAwesomeUrl('');
    setAwesomeError(null);
  };

  // Resolve Awesome Screenshot or shared image URL on the server
  const resolveAwesomeLink = async () => {
    if (!awesomeUrl) {
      setAwesomeError('Please enter a valid Awesome Screenshot share link.');
      return;
    }

    setIsResolvingAwesome(true);
    setAwesomeError(null);
    setError(null);

    try {
      const response = await fetch('/api/content-checker/resolve-awesome-screenshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: awesomeUrl.trim() })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Server error while resolving link.');
      }

      const data = await response.json();
      if (data.success && data.base64) {
        setScreenshotBase64(data.base64);
        setScreenshotPreview(data.base64);
        setAwesomeUrl(''); // clear on success
      } else {
        throw new Error(data.error || 'Failed to extract screenshot asset.');
      }
    } catch (err: any) {
      setAwesomeError(err.message || 'Could not resolve screenshot from link. Make sure it is a valid, public share page.');
    } finally {
      setIsResolvingAwesome(false);
    }
  };

  // Run Auditor Analysis
  const runAnalysis = async () => {
    if (!url) {
      setError('Please enter a valid website URL to crawl.');
      return;
    }
    if (!screenshotBase64) {
      setError('Please upload a screenshot of the reference document.');
      return;
    }

    // Basic URL validation
    let sanitizedUrl = url.trim();
    if (!/^https?:\/\//i.test(sanitizedUrl)) {
      sanitizedUrl = 'https://' + sanitizedUrl;
      setUrl(sanitizedUrl);
    }

    setIsLoading(true);
    setError(null);
    setReport(null);
    setWebpageData(null);

    // Progressive loading updates for professional feel
    const steps = [
      'Establishing connection & crawling webpage...',
      'Extracting HTML metadata, SEO, and headers...',
      'Synthesizing webpage elements & reading screenshot document...',
      'Comparing expected specs with live metadata matches...',
      'Analyzing content body discrepancies...',
      'Compiling final compliance report...'
    ];

    let currentStep = 0;
    setLoadingStep(steps[0]);
    const stepInterval = setInterval(() => {
      if (currentStep < steps.length - 1) {
        currentStep++;
        setLoadingStep(steps[currentStep]);
      }
    }, 2800);

    try {
      const response = await fetch('/api/content-checker/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: sanitizedUrl,
          image: screenshotBase64
        })
      });

      clearInterval(stepInterval);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Server returned an error.');
      }

      const data = await response.json();
      if (data.success) {
        setReport(data.report);
        setWebpageData(data.webpageData);
      } else {
        throw new Error(data.error || 'Failed to complete analysis.');
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      setError(err.message || 'An unexpected network error occurred while running the analysis.');
    } finally {
      setIsLoading(false);
    }
  };

  // Copy to Clipboard helper
  const handleCopyReport = () => {
    if (!report) return;
    const reportText = `CONTENT COMPLIANCE REPORT
Target Webpage: ${url}
Overall Score: ${report.overallScore}/100

SUMMARY
${report.summary}

SEO & METAS STATUS: ${report.seo.status.toUpperCase()}
- Expected Title: ${report.seo.expectedTitle}
- Actual Title: ${report.seo.actualTitle}
- Match Analysis: ${report.seo.analysis}

HEADINGS STATUS: ${report.headings.status.toUpperCase()}
- Headings analyzed: ${report.headings.matches.length}
- Key Highlights: ${report.headings.analysis}

RECOMMENDED ACTIONABLE ITEMS
${report.recommendations.map((rec, i) => `${i + 1}. [ ] ${rec}`).join('\n')}
`;
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Status helper color mapper
  const getStatusColor = (status: 'match' | 'partial' | 'mismatch' | string) => {
    switch (status) {
      case 'match':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30';
      case 'partial':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30';
      case 'mismatch':
      default:
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Tool Introduction */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30 uppercase tracking-wider">
          <Sparkles className="h-3 w-3" />
          <span>Full-Stack AI Agent</span>
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-neutral-100 tracking-tight">
          Content Copy & SEO Compliance Checker
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-405 leading-relaxed max-w-3xl">
          Upload a screenshot of your reference design or copy document and supply a live URL. The auditor will crawl the website, extract meta-properties and heading structures, and compare them with the document screenshot to identify content differences, SEO misses, and heading misalignments.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Control Input Panel (4 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-elegant-card border border-slate-200/80 dark:border-elegant-border rounded-2xl p-5 shadow-xs space-y-5">
            <div className="flex items-center gap-2 pb-3.5 border-b border-slate-150 dark:border-elegant-border">
              <Sliders className="h-4.5 w-4.5 text-indigo-500" />
              <h3 className="text-sm font-semibold tracking-tight">Configuration Parameters</h3>
            </div>

            {/* Target URL Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-405 flex items-center justify-between">
                <span>Target Webpage URL</span>
                <span className="text-[10px] text-slate-400">Must be public</span>
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g., example.com/landing-page"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isLoading}
                  className="w-full pl-9 pr-4 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-white dark:bg-elegant-bg dark:border-elegant-border focus:outline-none focus:ring-2 focus:ring-indigo-550/20 focus:border-indigo-550 text-slate-800 dark:text-slate-200 shadow-2xs"
                />
              </div>
            </div>

            {/* Reference Screenshot Upload */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-405">
                Reference Document Screenshot
              </label>

              {!screenshotPreview ? (
                <div className="space-y-3">
                  {/* Drag-and-drop zone with paste hint */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={triggerFileInput}
                    className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-150 min-h-[140px] ${
                      isDragging
                        ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/10'
                        : 'border-slate-200 dark:border-elegant-border hover:border-slate-305 dark:hover:border-elegant-border-hover bg-slate-50/50 dark:bg-elegant-bg/20'
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-elegant-bg border border-slate-200/50 dark:border-elegant-border/80 flex items-center justify-center text-slate-500 dark:text-slate-400 mb-2">
                      <FileImage className="h-4.5 w-4.5 text-indigo-500" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Click to upload, drag image, or paste (Ctrl+V)
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Supports Clipboard image, PNG, JPEG, WebP
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-2 py-1">
                    <span className="h-px bg-slate-150 dark:bg-elegant-border flex-1" />
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">OR</span>
                    <span className="h-px bg-slate-150 dark:bg-elegant-border flex-1" />
                  </div>

                  {/* Awesome Screenshot / general link input field */}
                  <div className="space-y-1.5 p-3.5 bg-slate-50/50 dark:bg-elegant-bg/20 border border-slate-200/60 dark:border-elegant-border/60 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-405 block">
                      Load from Awesome Screenshot Link
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Paste awesomescreenshot.com URL here..."
                        value={awesomeUrl}
                        onChange={(e) => setAwesomeUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            resolveAwesomeLink();
                          }
                        }}
                        disabled={isResolvingAwesome || isLoading}
                        className="flex-1 min-w-0 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white dark:bg-elegant-bg dark:border-elegant-border focus:outline-none focus:ring-2 focus:ring-indigo-550/20 focus:border-indigo-550 text-slate-800 dark:text-slate-200 shadow-2xs"
                      />
                      <button
                        type="button"
                        onClick={resolveAwesomeLink}
                        disabled={isResolvingAwesome || isLoading || !awesomeUrl}
                        className="px-3 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-elegant-bg dark:disabled:text-slate-600 rounded-lg shadow-xs cursor-pointer flex items-center justify-center gap-1 shrink-0"
                      >
                        {isResolvingAwesome ? (
                          <>
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            <span>Resolving...</span>
                          </>
                        ) : (
                          <span>Resolve</span>
                        )}
                      </button>
                    </div>
                    {awesomeError && (
                      <p className="text-[10px] text-rose-500 dark:text-rose-400 font-medium mt-1">
                        {awesomeError}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative border border-slate-200 dark:border-elegant-border rounded-xl p-2 bg-slate-50/30 dark:bg-elegant-bg/10">
                  <img
                    src={screenshotPreview}
                    alt="Uploaded reference document preview"
                    className="w-full h-auto max-h-[180px] object-contain rounded-lg"
                  />
                  <div className="absolute top-4 right-4 flex items-center gap-1.5">
                    <button
                      onClick={resetScreenshot}
                      disabled={isLoading}
                      className="px-2 py-1 rounded-md text-[10px] font-bold bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-950/40 shadow-xs cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Run Button */}
            <button
              onClick={runAnalysis}
              disabled={isLoading || !url || !screenshotBase64}
              className={`w-full py-3 rounded-xl font-bold text-sm tracking-tight flex items-center justify-center gap-2 transition-all duration-150 shadow-md ${
                isLoading || !url || !screenshotBase64
                  ? 'bg-slate-100 dark:bg-elegant-bg text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-elegant-border cursor-not-allowed shadow-none'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/15 cursor-pointer hover:shadow-lg'
              }`}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                  <span>Crawl & Analyze Compliance...</span>
                </>
              ) : (
                <>
                  <FileSearch className="h-4.5 w-4.5" />
                  <span>Verify Live Content Compliance</span>
                </>
              )}
            </button>
          </div>

          {/* Guidelines info card */}
          <div className="bg-slate-50/60 dark:bg-elegant-card border border-slate-200/50 dark:border-elegant-border rounded-xl p-4 text-xs space-y-3">
            <h4 className="font-bold text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              <span>How compliance audit works</span>
            </h4>
            <ol className="list-decimal pl-4 space-y-1.5 text-slate-500 dark:text-slate-400 font-medium">
              <li>Our backend runs a server-side curl to safely fetch the live HTML (bypassing CORS).</li>
              <li>A high-fidelity parser extracts metadata (title, metas) and heading levels (h1-h3).</li>
              <li>The screenshot reference and page variables are fed to the Gemini 3.6 Flash engine.</li>
              <li>The model calculates alignment scores, checks metadata syntax, heading wording, and looks for missing content.</li>
            </ol>
          </div>
        </div>

        {/* Right Output Analysis Panel (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Loading state */}
          {isLoading && (
            <div className="bg-white dark:bg-elegant-card border border-slate-200/80 dark:border-elegant-border rounded-2xl p-12 shadow-xs text-center flex flex-col items-center justify-center space-y-6 min-h-[460px]">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-indigo-50 dark:border-indigo-950/20 border-t-indigo-600 dark:border-t-indigo-400 animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Search className="h-5 w-5 text-indigo-500 animate-pulse" />
                </div>
              </div>
              <div className="space-y-2 max-w-md">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-neutral-100 tracking-tight">
                  Running Deep Compliance Analysis
                </h3>
                <p className="text-xs text-slate-405 dark:text-slate-400 font-medium font-mono bg-slate-50 dark:bg-elegant-bg px-4 py-2 rounded-lg border border-slate-150 dark:border-elegant-border animate-pulse">
                  {loadingStep}
                </p>
                <span className="text-[10px] text-slate-400 block pt-1">
                  Please do not reload, parsing public website assets took 5-8 seconds.
                </span>
              </div>
            </div>
          )}

          {/* 2. Error state */}
          {error && (
            <div className="bg-rose-50/50 dark:bg-rose-950/5 border border-rose-200 dark:border-rose-900/30 rounded-2xl p-6 shadow-xs flex gap-4 min-h-[220px] items-center">
              <div className="h-11 w-11 rounded-full bg-rose-50 dark:bg-rose-950 border border-rose-200 text-rose-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-rose-400">Analysis Error Encountered</h3>
                <p className="text-xs text-slate-500 dark:text-slate-405 font-medium leading-relaxed">
                  {error}
                </p>
                <div className="pt-1.5 flex gap-2">
                  <button
                    onClick={runAnalysis}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-elegant-card hover:bg-slate-100 dark:hover:bg-elegant-card-hover border border-rose-200 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 cursor-pointer shadow-xs"
                  >
                    Retry Verification
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. Empty State (Initial/Static) */}
          {!isLoading && !error && !report && (
            <div className="bg-white dark:bg-elegant-card border border-slate-200/80 dark:border-elegant-border rounded-2xl p-10 shadow-xs text-center flex flex-col items-center justify-center space-y-5 min-h-[460px]">
              <div className="h-14 w-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-center text-indigo-500">
                <Globe className="h-7 w-7" />
              </div>
              <div className="space-y-2 max-w-sm">
                <h3 className="font-extrabold text-base text-slate-800 dark:text-neutral-100 tracking-tight">
                  Awaiting Compliance Target
                </h3>
                <p className="text-xs text-slate-405 dark:text-slate-400 font-medium leading-relaxed">
                  Enter a target webpage and drag in your reference mockup screenshot, then run the checker to verify alignment and compliance instantly.
                </p>
              </div>
            </div>
          )}

          {/* 4. Complete Audit Report View */}
          {!isLoading && !error && report && (
            <div className="space-y-6 animate-fade-in">
              {/* Report Header Card */}
              <div className="bg-white dark:bg-elegant-card border border-slate-200/80 dark:border-elegant-border rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-elegant-bg px-2 py-0.5 rounded border border-slate-200 dark:border-elegant-border">
                      TARGET: {url.replace(/^https?:\/\/(www\.)?/, '').substring(0, 32)}...
                    </span>
                    {webpageData && (
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/15 border border-emerald-100 dark:border-emerald-900/30 px-2 py-0.5 rounded">
                        Successfully Crawled
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-neutral-100 tracking-tight">
                    Auditor Compliance Assessment
                  </h3>
                  <p className="text-xs text-slate-405 dark:text-slate-400 font-medium leading-relaxed">
                    {report.summary}
                  </p>
                </div>

                {/* Big Score Circular-ish widget */}
                <div className="sm:self-center shrink-0 flex flex-col items-center justify-center p-3 bg-slate-50 dark:bg-elegant-bg border border-slate-150 dark:border-elegant-border rounded-xl min-w-[100px]">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Overall Match</span>
                  <span className={`text-3xl font-black ${
                    report.overallScore >= 90 
                      ? 'text-emerald-500' 
                      : report.overallScore >= 70 
                        ? 'text-amber-500' 
                        : 'text-rose-500'
                  }`}>
                    {report.overallScore}%
                  </span>
                  <span className="text-[9px] text-slate-455 font-semibold">compliance score</span>
                </div>
              </div>

              {/* Tab Navigation buttons */}
              <div className="flex border-b border-slate-250 dark:border-elegant-border gap-1 overflow-x-auto pb-px">
                <button
                  onClick={() => setActiveTab('seo')}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    activeTab === 'seo'
                      ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 dark:text-slate-405 hover:text-slate-800 dark:hover:text-neutral-200'
                  }`}
                >
                  SEO & Metas Match
                </button>
                <button
                  onClick={() => setActiveTab('headings')}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    activeTab === 'headings'
                      ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 dark:text-slate-405 hover:text-slate-800 dark:hover:text-neutral-200'
                  }`}
                >
                  Heading Match
                </button>
                <button
                  onClick={() => setActiveTab('body')}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    activeTab === 'body'
                      ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 dark:text-slate-405 hover:text-slate-800 dark:hover:text-neutral-200'
                  }`}
                >
                  Body Copy Differences
                </button>
                <button
                  onClick={() => setActiveTab('recommendations')}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    activeTab === 'recommendations'
                      ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 dark:text-slate-405 hover:text-slate-800 dark:hover:text-neutral-200'
                  }`}
                >
                  Actionable Recommendations
                </button>
              </div>

              {/* Tab Contents */}
              <div className="space-y-4">
                
                {/* 4.1 SEO & METAS TAB */}
                {activeTab === 'seo' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Meta Compliance Status
                      </h4>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(report.seo.status)}`}>
                        SEO Status: {report.seo.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Document Title Match */}
                      <div className="bg-white dark:bg-elegant-card border border-slate-200/80 dark:border-elegant-border rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Page Title &lt;title&gt;</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                            report.seo.titleMatches 
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/10 dark:text-emerald-400 dark:border-emerald-900/20' 
                              : 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/10 dark:text-rose-400 dark:border-rose-900/20'
                          }`}>
                            {report.seo.titleMatches ? 'Match' : 'Mismatch'}
                          </span>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div>
                            <span className="text-[10px] font-semibold text-slate-400 block">Expected Title:</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{report.seo.expectedTitle || '(Empty)'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-slate-400 block">Actual Title:</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono break-all bg-slate-50 dark:bg-elegant-bg px-1.5 py-0.5 rounded border border-slate-150 dark:border-elegant-border/50 block mt-0.5">
                              {report.seo.actualTitle || '(None found)'}
                            </span>
                          </div>
                          {report.seo.titleDifference && (
                            <div className="pt-1.5 border-t border-slate-100 dark:border-elegant-border/50">
                              <span className="text-[10px] font-semibold text-rose-400 block">Discrepancy:</span>
                              <span className="text-slate-500 dark:text-slate-400 leading-relaxed block text-[11px]">{report.seo.titleDifference}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Meta Description Match */}
                      <div className="bg-white dark:bg-elegant-card border border-slate-200/80 dark:border-elegant-border rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Meta Description</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                            report.seo.descriptionMatches 
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/10 dark:text-emerald-400 dark:border-emerald-900/20' 
                              : 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/10 dark:text-rose-400 dark:border-rose-900/20'
                          }`}>
                            {report.seo.descriptionMatches ? 'Match' : 'Mismatch'}
                          </span>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div>
                            <span className="text-[10px] font-semibold text-slate-400 block">Expected Meta Description:</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300 block leading-normal">{report.seo.expectedDescription || '(Empty)'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-slate-400 block">Actual Meta Description:</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono text-[11px] leading-normal bg-slate-50 dark:bg-elegant-bg p-1.5 rounded border border-slate-150 dark:border-elegant-border/50 block mt-0.5">
                              {report.seo.actualDescription || '(None found)'}
                            </span>
                          </div>
                          {report.seo.descriptionDifference && (
                            <div className="pt-1.5 border-t border-slate-100 dark:border-elegant-border/50">
                              <span className="text-[10px] font-semibold text-rose-400 block">Discrepancy:</span>
                              <span className="text-slate-500 dark:text-slate-400 leading-relaxed block text-[11px]">{report.seo.descriptionDifference}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Meta SEO Overview */}
                    <div className="bg-white dark:bg-elegant-card border border-slate-200/80 dark:border-elegant-border rounded-xl p-4 text-xs space-y-2">
                      <h5 className="font-bold text-slate-800 dark:text-slate-300">Auditor SEO Assessment</h5>
                      <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                        {report.seo.analysis}
                      </p>
                    </div>
                  </div>
                )}

                {/* 4.2 HEADINGS MATCH TAB */}
                {activeTab === 'headings' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Heading Structure Assessment
                      </h4>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(report.headings.status)}`}>
                        Headings status: {report.headings.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Heading Matches Table / List */}
                    <div className="bg-white dark:bg-elegant-card border border-slate-200/80 dark:border-elegant-border rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-elegant-bg text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-elegant-border font-bold">
                            <tr>
                              <th className="px-4 py-3.5 font-bold uppercase text-[10px] tracking-wider">Level</th>
                              <th className="px-4 py-3.5 font-bold uppercase text-[10px] tracking-wider">Expected Text (Doc)</th>
                              <th className="px-4 py-3.5 font-bold uppercase text-[10px] tracking-wider">Actual Text (Live URL)</th>
                              <th className="px-4 py-3.5 font-bold uppercase text-[10px] tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-elegant-border/50 text-slate-650 dark:text-slate-350">
                            {report.headings.matches.map((heading, index) => (
                              <React.Fragment key={index}>
                                <tr className="hover:bg-slate-50/40 dark:hover:bg-elegant-bg/10">
                                  <td className="px-4 py-3.5 font-mono">
                                    <span className="bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30 px-2 py-0.5 rounded text-[10px] font-bold">
                                      {heading.level.toUpperCase()}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3.5 font-semibold leading-relaxed">{heading.expectedText || <span className="text-slate-400 font-normal italic">(None expected)</span>}</td>
                                  <td className="px-4 py-3.5 font-semibold leading-relaxed">{heading.actualText || <span className="text-rose-500 font-bold bg-rose-50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/20 px-1.5 py-0.5 rounded text-[10px] italic">Missing</span>}</td>
                                  <td className="px-4 py-3.5 font-bold">
                                    <span className={`px-2 py-0.5 rounded text-[10px] inline-flex border ${
                                      heading.status === 'match' 
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/15 dark:text-emerald-400 dark:border-emerald-900/30' 
                                        : heading.status === 'partial' 
                                          ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/15 dark:text-amber-400 dark:border-amber-900/30' 
                                          : 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/15 dark:text-rose-400 dark:border-rose-900/30'
                                    }`}>
                                      {heading.status.toUpperCase()}
                                    </span>
                                  </td>
                                </tr>
                                {heading.comment && (
                                  <tr className="bg-slate-50/20 dark:bg-elegant-bg/5">
                                    <td colSpan={4} className="px-4 py-2 border-b border-slate-100 dark:border-elegant-border/30 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                      <span className="font-bold text-slate-455">Auditor's Note:</span> {heading.comment}
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                            {report.headings.matches.length === 0 && (
                              <tr>
                                <td colSpan={4} className="text-center py-6 text-slate-400 italic">No headings identified during comparative check.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Heading Analysis Summary */}
                    <div className="bg-white dark:bg-elegant-card border border-slate-200/80 dark:border-elegant-border rounded-xl p-4 text-xs space-y-2">
                      <h5 className="font-bold text-slate-800 dark:text-slate-300">Auditor Heading Compliance Breakdown</h5>
                      <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                        {report.headings.analysis}
                      </p>
                    </div>
                  </div>
                )}

                {/* 4.3 BODY COPY DISCREPANCIES TAB */}
                {activeTab === 'body' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Website Copy Match Report
                      </h4>
                      <div className="flex gap-2 text-[10px] font-bold">
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">Matches: {report.bodyContent.matchesCount}</span>
                        <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded">Discrepancies: {report.bodyContent.mismatchesCount}</span>
                      </div>
                    </div>

                    {/* Discrepancies listing */}
                    <div className="space-y-3">
                      {report.bodyContent.mismatches.map((mismatch, index) => (
                        <div key={index} className="bg-white dark:bg-elegant-card border border-slate-200/80 dark:border-elegant-border rounded-xl p-4 text-xs space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-elegant-border/30 pb-2.5">
                            <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide text-[10px] flex items-center gap-1.5">
                              <Layers className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                              <span>Category: {mismatch.category}</span>
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                              mismatch.severity === 'high'
                                ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400'
                                : mismatch.severity === 'medium'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400'
                            }`}>
                              Severity: {mismatch.severity.toUpperCase()}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            <div className="space-y-1">
                              <span className="text-[10px] font-semibold text-slate-400 block uppercase">Expected Text (Doc specification)</span>
                              <p className="font-semibold text-slate-700 dark:text-slate-300 leading-normal font-sans bg-slate-50 dark:bg-elegant-bg/30 px-2 py-1.5 rounded border border-slate-100 dark:border-elegant-border/30">
                                {mismatch.expected || <span className="text-slate-400 italic font-normal">(None specified)</span>}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] font-semibold text-rose-400 block uppercase">Actual Text (Live on page)</span>
                              <p className="font-semibold text-slate-700 dark:text-slate-300 leading-normal font-sans bg-rose-50/10 dark:bg-rose-950/5 px-2 py-1.5 rounded border border-rose-100/30 dark:border-rose-900/10">
                                {mismatch.actual || <span className="text-rose-500 italic font-bold">Omitted / Missing</span>}
                              </p>
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed bg-slate-50/50 dark:bg-elegant-bg/10 p-2.5 rounded border border-slate-150 dark:border-elegant-border/30">
                            <span className="font-bold text-slate-455">Analysis:</span> {mismatch.comment}
                          </p>
                        </div>
                      ))}

                      {report.bodyContent.mismatches.length === 0 && (
                        <div className="bg-white dark:bg-elegant-card border border-slate-200/80 dark:border-elegant-border rounded-xl p-8 text-center text-slate-400 italic">
                          Perfect match! No textual copy discrepancies found between reference document and target URL.
                        </div>
                      )}
                    </div>

                    {/* Copy overall assessment */}
                    <div className="bg-white dark:bg-elegant-card border border-slate-200/80 dark:border-elegant-border rounded-xl p-4 text-xs space-y-2">
                      <h5 className="font-bold text-slate-800 dark:text-slate-300">Auditor Copy Compliance Assessment</h5>
                      <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                        {report.bodyContent.analysis}
                      </p>
                    </div>
                  </div>
                )}

                {/* 4.4 ACTIONABLE RECOMMENDATIONS TAB */}
                {activeTab === 'recommendations' && (
                  <div className="space-y-4 animate-fade-in">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Step-by-Step Action Plan
                    </h4>

                    {/* Recommendations Checklist */}
                    <div className="bg-white dark:bg-elegant-card border border-slate-200/80 dark:border-elegant-border rounded-xl p-5 shadow-xs space-y-4">
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Implement the following recommended content corrections to achieve 100% SEO, Meta, and Heading compliance on your target webpage:
                      </p>

                      <div className="space-y-3">
                        {report.recommendations.map((recommendation, i) => (
                          <div key={i} className="flex gap-3 text-xs items-start font-medium leading-normal hover:bg-slate-50/40 dark:hover:bg-elegant-bg/5 p-2 rounded-lg transition-colors">
                            <div className="h-4.5 w-4.5 rounded border border-slate-300 dark:border-elegant-border flex items-center justify-center shrink-0 mt-0.5 text-slate-300 hover:text-indigo-500 transition-colors">
                              <CheckSquare className="h-3.5 w-3.5 opacity-0 hover:opacity-100 hover:text-indigo-600 cursor-pointer" />
                            </div>
                            <span className="text-slate-650 dark:text-slate-350">{recommendation}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action Tools and Share buttons */}
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={handleCopyReport}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white dark:bg-elegant-card dark:border-elegant-border hover:bg-slate-50 dark:hover:bg-elegant-card-hover text-xs font-bold text-slate-750 dark:text-slate-300 flex items-center gap-2 shadow-xs cursor-pointer"
                      >
                        {copied ? <Check className="h-4 w-4 text-emerald-500 animate-bounce" /> : <Copy className="h-4 w-4 text-indigo-500" />}
                        <span>{copied ? 'Copied Assessment!' : 'Copy Full Audit Report'}</span>
                      </button>

                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white dark:bg-elegant-card dark:border-elegant-border hover:bg-slate-50 dark:hover:bg-elegant-card-hover text-xs font-bold text-slate-750 dark:text-slate-300 flex items-center gap-2 shadow-xs"
                      >
                        <ArrowUpRight className="h-4 w-4 text-slate-400" />
                        <span>Visit Target Webpage</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
