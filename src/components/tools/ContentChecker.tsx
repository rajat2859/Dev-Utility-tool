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
  CheckSquare, 
  ArrowUpRight,
  Upload,
  Trash2,
  Link2,
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

interface WebpageData {
  title: string;
  description: string;
  headingsCount: number;
}

export default function ContentChecker() {
  const [url, setUrl] = useState<string>('');
  const [awesomeUrl, setAwesomeUrl] = useState<string>('');
  const [rawHtml, setRawHtml] = useState<string>('');
  const [showHtmlPaste, setShowHtmlPaste] = useState<boolean>(false);

  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [webpageData, setWebpageData] = useState<WebpageData | null>(null);
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
        if (response.status === 404) {
          throw new Error('Analysis service endpoint not found (404). Please verify backend server is active.');
        }
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

  const runAnalysis = async () => {
    if (!url.trim() && !rawHtml.trim()) {
      setError('Please enter a Target Webpage URL.');
      return;
    }

    let currentBase64 = screenshotBase64;

    // If no screenshot image loaded yet, but Awesome Screenshot URL is provided, resolve it now automatically
    if (!currentBase64 && awesomeUrl.trim()) {
      currentBase64 = await resolveAwesomeLink(awesomeUrl);
      if (!currentBase64) {
        return; // Resolution failed, stop analysis
      }
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
    setWebpageData(null);

    const steps = [
      'Connecting to target webpage & fetching HTML metadata...',
      'Resolving reference screenshot elements...',
      'Comparing expected specs with live webpage elements...',
      'Analyzing text copy and heading hierarchy...',
      'Compiling comparison report...'
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

      const response = await fetch('/api/content-checker/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: sanitizedUrl || undefined,
          rawHtml: rawHtml.trim() || undefined,
          image: finalImagePayload
        })
      });

      clearInterval(stepInterval);

      const responseText = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(responseText);
      } catch {
        if (response.status === 404) {
          throw new Error('Analysis route returned 404. Ensure backend server is active.');
        }
        throw new Error(`Server returned status ${response.status} with a non-JSON response.`);
      }

      if (!response.ok) {
        throw new Error(data?.error || `Server returned error status ${response.status}.`);
      }

      if (data.success) {
        setReport(data.report);
        setWebpageData(data.webpageData);
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

  const handleCopyReport = () => {
    if (!report) return;
    const reportText = `CONTENT AUDIT REPORT
Target Source: ${url || 'Raw HTML Source'}
Overall Match Score: ${report.overallScore}%

SUMMARY:
${report.summary}

SEO & TITLE CHECK:
- Expected Title: ${report.seo.expectedTitle}
- Actual Title: ${report.seo.actualTitle}
- Result: ${report.seo.status.toUpperCase()}

HEADINGS MATCH:
- Status: ${report.headings.status.toUpperCase()}

COPY DISCREPANCIES (${report.bodyContent?.mismatchesCount || 0}):
${report.bodyContent?.mismatches.map(m => `- ${m.category}: Expected "${m.expected}" vs Actual "${m.actual}"`).join('\n') || 'None'}

RECOMMENDED FIXES:
${report.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}
`;
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 text-slate-900">
      {/* Streamlined Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-sky-600" />
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            SEO & Copy Auditor (URL vs. Awesome Screenshot)
          </h2>
        </div>
        <p className="text-xs text-slate-500">
          Compare live webpage URLs directly against Awesome Screenshot share links to audit title tags, heading hierarchy, and body copy accuracy.
        </p>
      </div>

      {/* Main 2-Input Primary Control Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* INPUT 1: Target Webpage URL */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-sky-600" />
                <span>1. Target Webpage URL</span>
              </span>
              <button
                type="button"
                onClick={() => setShowHtmlPaste(!showHtmlPaste)}
                className="text-[11px] text-sky-600 hover:underline font-normal cursor-pointer"
              >
                {showHtmlPaste ? 'Hide HTML Paste' : 'Or Paste Raw HTML'}
              </button>
            </label>

            {!showHtmlPaste ? (
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. https://example.com/landing-page"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isLoading}
                  className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:bg-white shadow-2xs"
                />
              </div>
            ) : (
              <textarea
                rows={3}
                placeholder="Paste webpage HTML source code here..."
                value={rawHtml}
                onChange={(e) => setRawHtml(e.target.value)}
                disabled={isLoading}
                className="w-full p-2.5 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:bg-white shadow-2xs"
              />
            )}
            <p className="text-[11px] text-slate-400">
              The published or live webpage URL you want to audit.
            </p>
          </div>

          {/* INPUT 2: Awesome Screenshot URL or Reference Upload */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Link2 className="h-4 w-4 text-sky-600" />
              <span>2. Awesome Screenshot URL</span>
            </label>

            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g. https://www.awesomescreenshot.com/image/..."
                    value={awesomeUrl}
                    onChange={(e) => setAwesomeUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        resolveAwesomeLink();
                      }
                    }}
                    disabled={isResolvingAwesome || isLoading}
                    className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:bg-white shadow-2xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => resolveAwesomeLink()}
                  disabled={isResolvingAwesome || isLoading || !awesomeUrl.trim()}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded-xl shadow-2xs cursor-pointer flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  {isResolvingAwesome ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <span>Fetch Screenshot</span>
                  )}
                </button>
              </div>

              {awesomeError && (
                <p className="text-[11px] text-rose-600 font-medium">
                  {awesomeError}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Screenshot Image Status / Fallback Upload Area */}
        <div className="pt-2 border-t border-slate-100">
          {screenshotPreview ? (
            <div className="flex items-center justify-between p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={screenshotPreview}
                  alt="Reference Preview"
                  className="h-12 w-16 object-cover rounded-lg border border-emerald-200 shrink-0"
                />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-emerald-900 block flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Reference Screenshot Ready
                  </span>
                  <p className="text-[11px] text-emerald-700 truncate">
                    Loaded and compressed for comparison
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetScreenshot}
                className="px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100/50 rounded-lg border border-rose-200 cursor-pointer transition-colors"
              >
                Change
              </button>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-colors flex items-center justify-center gap-3 ${
                isDragging
                  ? 'border-sky-500 bg-sky-50'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <FileImage className="h-5 w-5 text-slate-400" />
              <span className="text-xs text-slate-600 font-medium">
                Or drag & drop screenshot file / paste from clipboard (Ctrl+V)
              </span>
            </div>
          )}
        </div>

        {/* Main Compare Action Button */}
        <button
          type="button"
          onClick={runAnalysis}
          disabled={isLoading || (!url.trim() && !rawHtml.trim()) || (!awesomeUrl.trim() && !screenshotBase64)}
          className="w-full py-3 px-4 rounded-xl font-bold text-xs tracking-tight flex items-center justify-center gap-2 transition-all shadow-2xs bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin text-sky-400" />
              <span>Comparing Webpage with Awesome Screenshot...</span>
            </>
          ) : (
            <>
              <FileSearch className="h-4 w-4 text-emerald-400" />
              <span>Compare Webpage vs. Awesome Screenshot</span>
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

      {/* Loading Bar Progress */}
      {isLoading && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center flex flex-col items-center justify-center space-y-3">
          <div className="h-10 w-10 rounded-full border-2 border-slate-200 border-t-sky-600 animate-spin" />
          <p className="text-xs font-semibold text-slate-800">{loadingStep}</p>
        </div>
      )}

      {/* Streamlined Comparison Report */}
      {!isLoading && report && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-5">
          {/* Score Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Audit Verdict
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  report.overallScore >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {report.overallScore >= 90 ? 'High Compliance' : 'Discrepancies Found'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                {report.summary}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-center px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Match Score</span>
                <span className={`text-2xl font-bold ${
                  report.overallScore >= 90 ? 'text-emerald-600' : report.overallScore >= 70 ? 'text-amber-600' : 'text-rose-600'
                }`}>
                  {report.overallScore}%
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyReport}
                className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                title="Copy Summary"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Section 1: Page Title & Meta Tags Check */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-900 flex items-center justify-between">
              <span>1. Page Title & Meta Tags Comparison</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                report.seo.titleMatches ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {report.seo.titleMatches ? 'Title Match' : 'Title Discrepancy'}
              </span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Expected from Screenshot</span>
                <p className="font-semibold text-slate-800">{report.seo.expectedTitle || '(Title in screenshot)'}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Actual Webpage Title</span>
                <p className="font-semibold text-slate-800">{report.seo.actualTitle || '(No title tag found)'}</p>
              </div>
            </div>
          </div>

          {/* Section 2: Heading Hierarchy Check */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-900">
              2. Headings Comparison (H1, H2, H3)
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="px-3 py-2 text-[10px] uppercase">Tag</th>
                    <th className="px-3 py-2 text-[10px] uppercase">Webpage Heading Text</th>
                    <th className="px-3 py-2 text-[10px] uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {report.headings.matches.map((heading, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-mono font-bold text-[10px] text-slate-500">
                        {heading.level.toUpperCase()}
                      </td>
                      <td className="px-3 py-2 font-medium">{heading.actualText || 'Missing'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                          heading.status === 'match' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {heading.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Body Copy Discrepancies */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 flex items-center justify-between">
              <span>3. Text Copy Discrepancies</span>
              <span className="text-[11px] font-normal text-slate-500">
                {report.bodyContent?.mismatchesCount || 0} issue(s) detected
              </span>
            </h3>

            {report.bodyContent?.mismatches && report.bodyContent.mismatches.length > 0 ? (
              <div className="space-y-2">
                {report.bodyContent.mismatches.map((mismatch, i) => (
                  <div key={i} className="p-3 bg-rose-50/50 border border-rose-200/80 rounded-xl text-xs space-y-2">
                    <div className="flex items-center justify-between font-semibold text-rose-900">
                      <span>{mismatch.category}</span>
                      <span className="text-[10px] uppercase px-1.5 py-0.5 bg-rose-100 rounded text-rose-800">
                        {mismatch.severity}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="p-2 bg-white rounded-lg border border-rose-100">
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Expected (Screenshot):</span>
                        <p className="text-slate-800 font-medium">{mismatch.expected}</p>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-rose-100">
                        <span className="text-[10px] text-rose-600 font-semibold block uppercase">Actual (Webpage):</span>
                        <p className="text-slate-800 font-medium">{mismatch.actual}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-emerald-50/50 border border-emerald-200/80 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>No text copy discrepancies found! Webpage text matches screenshot reference.</span>
              </div>
            )}
          </div>

          {/* Section 4: Recommended Action Items */}
          {report.recommendations && report.recommendations.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-900">
                4. Action Plan Fixes
              </h3>
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5 text-xs text-slate-700">
                {report.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckSquare className="h-3.5 w-3.5 text-sky-600 shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
