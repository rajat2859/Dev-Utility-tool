import React, { useState, useRef } from 'react';
import { 
  Globe, 
  FileImage, 
  Search, 
  AlertTriangle, 
  Info, 
  Sparkles, 
  RefreshCw, 
  Copy, 
  Check, 
  FileSearch, 
  Layers, 
  Sliders, 
  CheckSquare, 
  ArrowUpRight,
  Code
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

interface WebpageData {
  title: string;
  description: string;
  headingsCount: number;
}

export default function ContentChecker() {
  const [inputType, setInputType] = useState<'url' | 'html'>('url');
  const [url, setUrl] = useState<string>('');
  const [rawHtml, setRawHtml] = useState<string>('');
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

  const [awesomeUrl, setAwesomeUrl] = useState<string>('');
  const [isResolvingAwesome, setIsResolvingAwesome] = useState<boolean>(false);
  const [awesomeError, setAwesomeError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (dataUrl: string, maxWidth = 1600, maxHeight = 1600, quality = 0.85): Promise<string> => {
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

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const resetScreenshot = () => {
    setScreenshotBase64(null);
    setScreenshotPreview(null);
    setAwesomeUrl('');
    setAwesomeError(null);
  };

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: awesomeUrl.trim() })
      });

      const responseText = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        if (response.status === 404) {
          throw new Error('Analysis service endpoint not found (404). Please verify backend server is active.');
        }
        throw new Error(`Server returned status ${response.status}. Received non-JSON response format.`);
      }

      if (!response.ok) {
        throw new Error(data?.error || `Server error (${response.status}) while resolving link.`);
      }

      if (data.success && data.base64) {
        const compressed = await compressImage(data.base64);
        setScreenshotBase64(compressed);
        setScreenshotPreview(compressed);
        setAwesomeUrl('');
      } else {
        throw new Error(data?.error || 'Failed to extract screenshot asset.');
      }
    } catch (err: any) {
      setAwesomeError(err.message || 'Could not resolve screenshot from link. Make sure it is a valid, public share page.');
    } finally {
      setIsResolvingAwesome(false);
    }
  };

  const runAnalysis = async () => {
    if (inputType === 'url' && !url) {
      setError('Please enter a valid website URL to crawl.');
      return;
    }
    if (inputType === 'html' && !rawHtml.trim()) {
      setError('Please paste the webpage HTML source code or text.');
      return;
    }
    if (!screenshotBase64) {
      setError('Please upload a screenshot of the reference document.');
      return;
    }

    let sanitizedUrl = url.trim();
    if (inputType === 'url' && !/^https?:\/\//i.test(sanitizedUrl)) {
      sanitizedUrl = 'https://' + sanitizedUrl;
      setUrl(sanitizedUrl);
    }

    setIsLoading(true);
    setError(null);
    setReport(null);
    setWebpageData(null);

    const steps = [
      inputType === 'url' ? 'Establishing connection & crawling webpage...' : 'Parsing raw HTML & metadata...',
      'Extracting HTML metadata, SEO tags, and headers...',
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
    }, 2000);

    try {
      // Ensure image payload is optimized before sending
      const finalImagePayload = await compressImage(screenshotBase64);

      const response = await fetch('/api/content-checker/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: inputType === 'url' ? sanitizedUrl : undefined,
          rawHtml: inputType === 'html' ? rawHtml : undefined,
          image: finalImagePayload
        })
      });

      clearInterval(stepInterval);

      const responseText = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        if (response.status === 404) {
          throw new Error('Analysis server API route (/api/content-checker/analyze) returned 404. Ensure backend dev server is running.');
        } else if (response.status === 413) {
          throw new Error('Screenshot payload exceeded server limits. Please try a smaller or compressed screenshot.');
        }
        throw new Error(`Server returned status ${response.status} with a non-JSON response.`);
      }

      if (!response.ok) {
        throw new Error(data?.error || `Server returned error status ${response.status}.`);
      }

      if (data.success) {
        setReport(data.report);
        setWebpageData(data.webpageData);
        if (data.report.bodyContent && (data.report.bodyContent.mismatchesCount > 0 || (data.report.bodyContent.mismatches && data.report.bodyContent.mismatches.length > 0))) {
          setActiveTab('body');
        } else if (data.report.headings && data.report.headings.status === 'mismatch') {
          setActiveTab('headings');
        } else {
          setActiveTab('seo');
        }
      } else {
        throw new Error(data?.error || 'Failed to complete analysis.');
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      setError(err.message || 'An unexpected error occurred while running the analysis.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyReport = () => {
    if (!report) return;
    const reportText = `CONTENT COMPLIANCE REPORT
Target Source: ${inputType === 'url' ? url : 'Raw HTML Code'}
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

  const getStatusColor = (status: 'match' | 'partial' | 'mismatch' | string) => {
    switch (status) {
      case 'match':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'partial':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'mismatch':
      default:
        return 'bg-rose-50 text-rose-700 border-rose-200';
    }
  };

  return (
    <div className="space-y-6 text-zinc-900">
      {/* Tool Header */}
      <div className="border-b border-zinc-200 pb-4 space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold tracking-tight">Content Copy & SEO Compliance Checker</h2>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800 border border-zinc-200">
            <Sparkles className="h-3 w-3 text-zinc-700" />
            AI Auditor
          </span>
        </div>
        <p className="text-xs text-zinc-500">
          Upload reference mockup screenshots and provide a live URL or raw HTML to verify metadata, heading hierarchy, and body copy accuracy.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Control Input Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-zinc-700" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900">Input Mode</h3>
              </div>
              <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setInputType('url')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    inputType === 'url' ? 'bg-white text-zinc-900 shadow-xs font-semibold' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    Target URL
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputType('html')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    inputType === 'html' ? 'bg-white text-zinc-900 shadow-xs font-semibold' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <Code className="h-3 w-3" />
                    Paste HTML
                  </span>
                </button>
              </div>
            </div>

            {/* Target URL or HTML Source Input */}
            {inputType === 'url' ? (
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500 flex items-center justify-between">
                  <span>Target Webpage URL</span>
                  <span className="text-[10px] text-zinc-400">Public web page</span>
                </label>
                <div className="relative">
                  <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="e.g., example.com/landing-page"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isLoading}
                    className="w-full pl-8 pr-3 py-1.5 text-xs font-medium rounded-md border border-zinc-200 bg-white text-zinc-900 focus:ring-1 focus:ring-zinc-950 shadow-xs"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500 flex items-center justify-between">
                  <span>Webpage HTML Source / Text</span>
                  <span className="text-[10px] text-zinc-400">Local dev or protected site</span>
                </label>
                <textarea
                  rows={5}
                  placeholder="Paste <!DOCTYPE html>... or text copy here"
                  value={rawHtml}
                  onChange={(e) => setRawHtml(e.target.value)}
                  disabled={isLoading}
                  className="w-full p-2.5 text-xs font-mono rounded-md border border-zinc-200 bg-white text-zinc-900 focus:ring-1 focus:ring-zinc-950 shadow-xs resize-y"
                />
              </div>
            )}

            {/* Reference Screenshot Upload */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-500 block">
                Reference Document Screenshot
              </label>

              {!screenshotPreview ? (
                <div className="space-y-3">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={triggerFileInput}
                    className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                      isDragging
                        ? 'border-zinc-900 bg-zinc-100'
                        : 'border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100/50'
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <div className="h-8 w-8 rounded-md bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600 mb-2">
                      <FileImage className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold text-zinc-900">
                      Click to upload, drag image, or paste (Ctrl+V)
                    </span>
                    <span className="text-[10px] text-zinc-400 mt-0.5">
                      Supports Clipboard, PNG, JPEG, WebP
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="h-px bg-zinc-200 flex-1" />
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase">OR</span>
                    <span className="h-px bg-zinc-200 flex-1" />
                  </div>

                  <div className="space-y-1.5 p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
                    <span className="text-[10px] font-medium text-zinc-600 block">
                      Awesome Screenshot Share Link
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Paste URL..."
                        value={awesomeUrl}
                        onChange={(e) => setAwesomeUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            resolveAwesomeLink();
                          }
                        }}
                        disabled={isResolvingAwesome || isLoading}
                        className="flex-1 px-2.5 py-1 text-xs font-medium rounded-md border border-zinc-200 bg-white text-zinc-900 focus:ring-1 focus:ring-zinc-950 shadow-xs"
                      />
                      <button
                        type="button"
                        onClick={resolveAwesomeLink}
                        disabled={isResolvingAwesome || isLoading || !awesomeUrl}
                        className="px-3 py-1 text-xs font-medium text-zinc-50 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 rounded-md shadow-xs cursor-pointer flex items-center gap-1"
                      >
                        {isResolvingAwesome ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <span>Resolve</span>
                        )}
                      </button>
                    </div>
                    {awesomeError && (
                      <p className="text-[10px] text-rose-600 font-medium mt-1">
                        {awesomeError}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative border border-zinc-200 rounded-lg p-2 bg-zinc-50">
                  <img
                    src={screenshotPreview}
                    alt="Uploaded reference preview"
                    className="w-full h-auto max-h-[160px] object-contain rounded-md"
                  />
                  <button
                    onClick={resetScreenshot}
                    disabled={isLoading}
                    className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-medium bg-white border border-zinc-200 text-rose-600 hover:bg-rose-50 shadow-xs cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Run Button */}
            <button
              onClick={runAnalysis}
              disabled={isLoading || (inputType === 'url' ? !url : !rawHtml.trim()) || !screenshotBase64}
              className="w-full py-2 px-4 rounded-md font-medium text-xs tracking-tight flex items-center justify-center gap-2 transition-colors shadow-xs bg-zinc-900 text-zinc-50 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Analyzing Content...</span>
                </>
              ) : (
                <>
                  <FileSearch className="h-3.5 w-3.5" />
                  <span>Verify Content Compliance</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-xs space-y-2">
            <h4 className="font-semibold text-zinc-900 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-zinc-700 shrink-0" />
              <span>How compliance audit works</span>
            </h4>
            <ol className="list-decimal pl-4 space-y-1 text-zinc-600 font-normal">
              <li>Analyzes webpage title, meta description, and heading hierarchy (h1-h6).</li>
              <li>Compares target text content against reference document screenshots.</li>
              <li>Produces precise accuracy scores, discrepancy highlights, and actionable fixes.</li>
            </ol>
          </div>
        </div>

        {/* Right Output Analysis Panel (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Loading state */}
          {isLoading && (
            <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center flex flex-col items-center justify-center space-y-4 min-h-[400px]">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Search className="h-4 w-4 text-zinc-700" />
                </div>
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="font-semibold text-sm text-zinc-900">
                  Running Compliance Analysis
                </h3>
                <p className="text-xs text-zinc-500 font-mono bg-zinc-50 px-3 py-1.5 rounded-md border border-zinc-200">
                  {loadingStep}
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-5 shadow-xs flex gap-3 items-start">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <h3 className="font-semibold text-xs text-rose-900">Analysis Notice</h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  {error}
                </p>
                <button
                  onClick={runAnalysis}
                  className="px-2.5 py-1 rounded text-xs font-medium bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer shadow-xs"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && !report && (
            <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center flex flex-col items-center justify-center space-y-4 min-h-[400px]">
              <div className="h-10 w-10 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700">
                <Globe className="h-5 w-5" />
              </div>
              <div className="space-y-1 max-w-xs">
                <h3 className="font-semibold text-sm text-zinc-900">
                  Awaiting Compliance Target
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Provide a target webpage URL or HTML source code, and upload a reference mockup image to start the automated audit.
                </p>
              </div>
            </div>
          )}

          {/* Complete Audit Report View */}
          {!isLoading && !error && report && (
            <div className="space-y-5">
              {/* Summary Header Card */}
              <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                      TARGET: {inputType === 'url' ? url.replace(/^https?:\/\/(www\.)?/, '').substring(0, 30) : 'Pasted HTML'}...
                    </span>
                    {webpageData && (
                      <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        Analyzed
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-900">
                    Compliance Assessment
                  </h3>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    {report.summary}
                  </p>
                </div>

                <div className="shrink-0 flex flex-col items-center justify-center p-3 bg-zinc-50 border border-zinc-200 rounded-lg min-w-[90px]">
                  <span className="text-[9px] uppercase font-semibold text-zinc-500">Score</span>
                  <span className={`text-2xl font-bold ${
                    report.overallScore >= 90 
                      ? 'text-emerald-600' 
                      : report.overallScore >= 70 
                        ? 'text-amber-600' 
                        : 'text-rose-600'
                  }`}>
                    {report.overallScore}%
                  </span>
                </div>
              </div>

              {/* Warning alert if copy discrepancies detected */}
              {report.bodyContent && report.bodyContent.mismatchesCount > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-900">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Copy Discrepancies Detected!</span>
                    <p className="text-[11px] text-rose-700 mt-0.5">
                      Found {report.bodyContent.mismatchesCount} paragraph/copy discrepancy(ies) between the reference document screenshot and the webpage content. Check the "Copy Differences" tab below for line-by-line comparison.
                    </p>
                  </div>
                </div>
              )}

              {/* Tab Navigation */}
              <div className="flex border-b border-zinc-200 gap-1 overflow-x-auto pb-px text-xs no-scrollbar">
                <button
                  onClick={() => setActiveTab('seo')}
                  className={`px-3 py-1.5 font-medium border-b-2 cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'seo'
                      ? 'border-zinc-900 text-zinc-900 font-semibold'
                      : 'border-transparent text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  SEO & Metas
                </button>
                <button
                  onClick={() => setActiveTab('headings')}
                  className={`px-3 py-1.5 font-medium border-b-2 cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'headings'
                      ? 'border-zinc-900 text-zinc-900 font-semibold'
                      : 'border-transparent text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  Headings
                </button>
                <button
                  onClick={() => setActiveTab('body')}
                  className={`px-3 py-1.5 font-medium border-b-2 cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    activeTab === 'body'
                      ? 'border-zinc-900 text-zinc-900 font-semibold'
                      : 'border-transparent text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <span>Copy Differences</span>
                  {report.bodyContent && report.bodyContent.mismatchesCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-800 font-bold border border-rose-200">
                      {report.bodyContent.mismatchesCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('recommendations')}
                  className={`px-3 py-1.5 font-medium border-b-2 cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'recommendations'
                      ? 'border-zinc-900 text-zinc-900 font-semibold'
                      : 'border-transparent text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  Recommendations
                </button>
              </div>

              {/* Tab Contents */}
              <div className="space-y-4">
                
                {/* SEO & METAS TAB */}
                {activeTab === 'seo' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Meta Compliance Status
                      </h4>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusColor(report.seo.status)}`}>
                        {report.seo.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-zinc-700">Page Title</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                            report.seo.titleMatches ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {report.seo.titleMatches ? 'Match' : 'Mismatch'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-400 block">Expected:</span>
                          <span className="font-medium text-zinc-800">{report.seo.expectedTitle || '(Empty)'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-400 block">Actual:</span>
                          <span className="font-mono text-zinc-800 bg-zinc-50 p-1 rounded border border-zinc-200 block text-[11px] break-all">
                            {report.seo.actualTitle || '(None)'}
                          </span>
                        </div>
                      </div>

                      <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-zinc-700">Meta Description</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                            report.seo.descriptionMatches ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {report.seo.descriptionMatches ? 'Match' : 'Mismatch'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-400 block">Expected:</span>
                          <span className="font-medium text-zinc-800">{report.seo.expectedDescription || '(Empty)'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-400 block">Actual:</span>
                          <span className="font-mono text-zinc-800 bg-zinc-50 p-1 rounded border border-zinc-200 block text-[11px] break-all">
                            {report.seo.actualDescription || '(None)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-zinc-200 rounded-xl p-4 text-xs space-y-1">
                      <h5 className="font-semibold text-zinc-900">SEO Assessment</h5>
                      <p className="text-zinc-600 leading-relaxed font-normal">
                        {report.seo.analysis}
                      </p>
                    </div>
                  </div>
                )}

                {/* HEADINGS MATCH TAB */}
                {activeTab === 'headings' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Heading Structure Assessment
                      </h4>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusColor(report.headings.status)}`}>
                        {report.headings.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="bg-white border border-zinc-200 rounded-xl overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-50 text-zinc-500 border-b border-zinc-200 font-semibold">
                          <tr>
                            <th className="px-3 py-2 text-[10px] uppercase">Level</th>
                            <th className="px-3 py-2 text-[10px] uppercase">Expected</th>
                            <th className="px-3 py-2 text-[10px] uppercase">Actual</th>
                            <th className="px-3 py-2 text-[10px] uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 text-zinc-800">
                          {report.headings.matches.map((heading, index) => (
                            <tr key={index} className="hover:bg-zinc-50/50">
                              <td className="px-3 py-2 font-mono">
                                <span className="bg-zinc-100 text-zinc-800 border border-zinc-200 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                  {heading.level.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-medium">{heading.expectedText || <span className="text-zinc-400 italic">(None)</span>}</td>
                              <td className="px-3 py-2 font-medium">{heading.actualText || <span className="text-rose-600 font-medium">Missing</span>}</td>
                              <td className="px-3 py-2">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                  heading.status === 'match' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                    : heading.status === 'partial' 
                                      ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}>
                                  {heading.status.toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="bg-white border border-zinc-200 rounded-xl p-4 text-xs space-y-1">
                      <h5 className="font-semibold text-zinc-900">Heading Assessment</h5>
                      <p className="text-zinc-600 leading-relaxed font-normal">
                        {report.headings.analysis}
                      </p>
                    </div>
                  </div>
                )}

                {/* BODY COPY DISCREPANCIES TAB */}
                {activeTab === 'body' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Website Copy Match
                      </h4>
                      <div className="flex gap-2 text-[10px] font-medium">
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">Matches: {report.bodyContent.matchesCount}</span>
                        <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded">Discrepancies: {report.bodyContent.mismatchesCount}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {report.bodyContent.mismatches.map((mismatch, index) => (
                        <div key={index} className="bg-white border border-zinc-200 rounded-xl p-4 text-xs space-y-2">
                          <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                            <span className="font-semibold text-zinc-900 flex items-center gap-1.5">
                              <Layers className="h-3.5 w-3.5 text-zinc-500" />
                              <span>Category: {mismatch.category}</span>
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                              mismatch.severity === 'high'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : mismatch.severity === 'medium'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                            }`}>
                              Severity: {mismatch.severity.toUpperCase()}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                            <div>
                              <span className="text-[10px] text-zinc-400 block uppercase font-medium">Expected:</span>
                              <p className="font-medium text-zinc-800 bg-zinc-50 p-2 rounded border border-zinc-100">
                                {mismatch.expected || <span className="text-zinc-400 italic">(None)</span>}
                              </p>
                            </div>
                            <div>
                              <span className="text-[10px] text-rose-600 block uppercase font-medium">Actual:</span>
                              <p className="font-medium text-zinc-800 bg-rose-50/20 p-2 rounded border border-rose-100">
                                {mismatch.actual || <span className="text-rose-600 italic">Missing</span>}
                              </p>
                            </div>
                          </div>

                          <p className="text-[11px] text-zinc-500 pt-1">
                            <strong className="text-zinc-700">Analysis:</strong> {mismatch.comment}
                          </p>
                        </div>
                      ))}

                      {report.bodyContent.mismatches.length === 0 && (
                        <div className="bg-white border border-zinc-200 rounded-xl p-6 text-center text-zinc-400 italic text-xs">
                          No text copy discrepancies found.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ACTIONABLE RECOMMENDATIONS TAB */}
                {activeTab === 'recommendations' && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Action Plan
                    </h4>

                    <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-3">
                      <div className="space-y-2">
                        {report.recommendations.map((recommendation, i) => (
                          <div key={i} className="flex gap-2.5 text-xs items-start font-medium text-zinc-800">
                            <CheckSquare className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />
                            <span>{recommendation}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyReport}
                        className="px-3 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-900 flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-zinc-700" />}
                        <span>{copied ? 'Copied!' : 'Copy Assessment'}</span>
                      </button>

                      {inputType === 'url' && url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-900 flex items-center gap-1.5 shadow-xs"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5 text-zinc-500" />
                          <span>Visit Target Webpage</span>
                        </a>
                      )}
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
