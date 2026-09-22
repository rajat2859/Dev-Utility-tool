import React, { useState, useRef } from 'react';
import {
  Globe,
  FileImage,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  FileSearch,
  Link2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileText,
  Layers,
  ChevronDown,
  ChevronRight,
  Code,
  Activity,
  SlidersHorizontal,
  Info,
  Heading
} from 'lucide-react';
import { normalizeUrl } from '../../lib/utils';

const CHECK_CATEGORIES = [
  { id: 'title', label: 'URL, Title & Description' },
  { id: 'headings', label: 'Headings' },
  { id: 'paragraphs', label: 'Paragraphs' },
  { id: 'lists', label: 'List Items' },
  { id: 'tables', label: 'Tables' },
  { id: 'image', label: 'Feature Image' },
  { id: 'faq', label: 'FAQ Schema' },
] as const;

// Maps a mismatch's free-text category (from the local comparator) to one of the
// checkable groups above, so the UI can filter to only what the user asked for.
function categoryGroup(category: string): string {
  const c = category.toLowerCase();
  if (c.includes('title')) return 'title';
  if (c.includes('heading')) return 'headings';
  if (c.includes('paragraph')) return 'paragraphs';
  if (c.includes('list')) return 'lists';
  if (c.includes('table')) return 'tables';
  return 'other';
}

interface SEOSection {
  urlMatches: boolean;
  expectedUrl: string;
  actualUrl: string;
  urlDifference: string;
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
  level: string;
  expectedText: string;
  actualText: string;
  status: 'match' | 'partial' | 'mismatch';
  comment: string;
  expectedLevel?: number;
  actualLevel?: number;
  structureStatus?: string;
  copyStatus?: string;
  order?: number;
}

interface HeadingsSection {
  status: 'match' | 'partial' | 'mismatch';
  matches: HeadingMatch[];
  analysis: string;
}

interface DiffWord {
  value: string;
  added?: boolean;
  removed?: boolean;
}

interface BodyMismatch {
  category: string;
  expected: string;
  actual: string;
  severity: 'high' | 'medium' | 'low';
  comment: string;
  status?: 'match' | 'mismatch';
  difference?: DiffWord[];
  evidence?: string;
}

interface BodyContentSection {
  status: 'match' | 'partial' | 'mismatch';
  mismatches: BodyMismatch[];
  matchesCount: number;
  mismatchesCount: number;
  analysis: string;
}

interface FaqSchemaSection {
  present: boolean;
  rawJson: string;
  status: 'match' | 'mismatch' | 'missing' | 'not_present';
  mismatchDetails: string[];
  analysis: string;
}

interface FeatureImageSection {
  applicable: boolean;
  expected: string;
  actual: string;
  matches: boolean;
  analysis: string;
}

interface PageExtractionDiagnostics {
  fetchMethod: string;
  httpStatus?: number;
  htmlSize: number;
  rendered: boolean;
  detectedMainContentBlocks: number;
  detectedHeadings: number;
  detectedParagraphs: number;
  detectedTables: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  confidenceScore: number;
  notes: string[];
}

interface ReferenceExtractionDiagnostics {
  source: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  confidenceScore: number;
  characterCount: number;
  blockCount: number;
  lineCount: number;
  tileCount?: number;
  ocrConfidence?: number;
  unverifiedFields: string[];
  notes: string[];
}

interface AuditIssue {
  id: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  message: string;
  expected?: string;
  actual?: string;
  evidence?: string;
  difference?: DiffWord[];
}

interface AnalysisReport {
  status?: 'PASS' | 'PASS_WITH_MINOR_DIFFERENCES' | 'FAIL' | 'UNVERIFIED';
  extraction?: {
    page: PageExtractionDiagnostics;
    reference: ReferenceExtractionDiagnostics;
  };
  issues?: AuditIssue[];
  seo: SEOSection;
  headings: HeadingsSection;
  bodyContent: BodyContentSection;
  faqSchema?: FaqSchemaSection;
  featureImage?: FeatureImageSection;
  overallScore: number;
  summary: string;
  recommendations: string[];
}

function renderDiff(diff?: DiffWord[]) {
  if (!diff || diff.length === 0) return null;
  return (
    <div className="font-mono text-[11px] leading-relaxed p-2 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto flex flex-wrap gap-1 items-center">
      {diff.map((token, i) => {
        if (token.added) {
          return (
            <span key={i} className="bg-emerald-800/80 text-emerald-200 font-semibold px-1 py-0.5 rounded border border-emerald-600/50">
              +{token.value}
            </span>
          );
        }
        if (token.removed) {
          return (
            <span key={i} className="bg-rose-900/80 text-rose-200 line-through px-1 py-0.5 rounded border border-rose-600/50 opacity-80">
              -{token.value}
            </span>
          );
        }
        return <span key={i} className="text-slate-300">{token.value}</span>;
      })}
    </div>
  );
}

function getStatusBadge(status?: string) {
  switch (status) {
    case 'PASS':
      return {
        cardBg: 'bg-emerald-50/80 border-emerald-200',
        badgeBg: 'bg-emerald-600 text-white',
        textCol: 'text-emerald-900',
        label: 'AUDIT PASS',
        desc: 'All tested elements strictly match the design reference.'
      };
    case 'PASS_WITH_MINOR_DIFFERENCES':
      return {
        cardBg: 'bg-blue-50/80 border-blue-200',
        badgeBg: 'bg-blue-600 text-white',
        textCol: 'text-blue-900',
        label: 'PASS (MINOR DIFFERENCES)',
        desc: 'Document structure and key content match with minor copy variations.'
      };
    case 'FAIL':
      return {
        cardBg: 'bg-rose-50/80 border-rose-200',
        badgeBg: 'bg-rose-600 text-white',
        textCol: 'text-rose-900',
        label: 'AUDIT FAIL',
        desc: 'Critical mismatches, missing content, or structural deviations detected.'
      };
    case 'UNVERIFIED':
    default:
      return {
        cardBg: 'bg-amber-50/80 border-amber-200',
        badgeBg: 'bg-amber-600 text-white',
        textCol: 'text-amber-900',
        label: 'UNVERIFIED',
        desc: 'Extraction confidence is too low or incomplete for a dependable compliance audit.'
      };
  }
}

export default function ContentChecker() {
  const [url, setUrl] = useState<string>('');
  const [rawHtml, setRawHtml] = useState<string>('');
  const [showHtmlPaste, setShowHtmlPaste] = useState<boolean>(false);

  // Screenshot QA states
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [showFaqJson, setShowFaqJson] = useState<boolean>(false);

  // Single reference-link field: accepts either an Awesome Screenshot share URL or a Google Doc share URL
  const [referenceUrl, setReferenceUrl] = useState<string>('');
  const [isResolvingReference, setIsResolvingReference] = useState<boolean>(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [referenceDocText, setReferenceDocText] = useState<string | null>(null);
  const [contentSelector, setContentSelector] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);

  const [selectedChecks, setSelectedChecks] = useState<Set<string>>(
    new Set(CHECK_CATEGORIES.map((c) => c.id))
  );
  const [showAllMatches, setShowAllMatches] = useState<boolean>(false);
  const toggleCheck = (id: string) => {
    setSelectedChecks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preserve vertical resolution for tall screenshots (Fix 9)
  const compressImage = (dataUrl: string, maxWidth = 2500, quality = 0.9): Promise<string> => {
    return new Promise((resolve) => {
      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        return resolve(dataUrl);
      }
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        if (width === img.width && height === img.height && dataUrl.length < 15 * 1024 * 1024) {
          return resolve(dataUrl);
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
              setReferenceError(null);
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
    setReferenceError(null);
  };

  // Auto-detects whether the pasted link is an Awesome Screenshot share URL or a Google Doc share URL,
  // resolves it against the matching backend endpoint, and returns the resolved payload.
  const resolveReferenceLink = async (
    targetUrl?: string
  ): Promise<{ type: 'awesome'; value: string } | { type: 'doc'; value: string } | null> => {
    const linkToResolve = (targetUrl ?? referenceUrl).trim();
    if (!linkToResolve) {
      setReferenceError('Please enter an Awesome Screenshot or Google Doc share URL.');
      return null;
    }

    const isDoc = /docs\.google\.com/i.test(linkToResolve);
    const isAwesome = /awesomescreenshot\.com/i.test(linkToResolve);
    if (!isDoc && !isAwesome) {
      setReferenceError('Enter a valid Awesome Screenshot (awesomescreenshot.com) or Google Doc (docs.google.com) share link.');
      return null;
    }

    setIsResolvingReference(true);
    setReferenceError(null);
    setError(null);

    try {
      const endpoint = isDoc
        ? '/api/content-checker/resolve-google-doc'
        : '/api/content-checker/resolve-awesome-screenshot';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkToResolve })
      });

      const responseText = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(`Server returned status ${response.status}. Received non-JSON response format.`);
      }

      if (!response.ok) {
        throw new Error(data?.error || `Server error (${response.status}) while resolving the reference link.`);
      }

      if (isDoc) {
        if (data.success && data.text) {
          setReferenceDocText(data.text);
          return { type: 'doc', value: data.text };
        }
        throw new Error(data?.error || 'Failed to extract text from Google Doc link.');
      }

      if (data.success && data.base64) {
        const compressed = await compressImage(data.base64);
        setScreenshotBase64(compressed);
        setScreenshotPreview(compressed);
        return { type: 'awesome', value: compressed };
      }
      throw new Error(data?.error || 'Failed to extract screenshot asset from Awesome Screenshot link.');
    } catch (err: any) {
      setReferenceError(err.message || 'Could not resolve the reference link.');
      return null;
    } finally {
      setIsResolvingReference(false);
    }
  };

  const resetReferenceDoc = () => {
    setReferenceDocText(null);
    setReferenceError(null);
  };

  const runScreenshotAnalysis = async () => {
    if (!url.trim() && !rawHtml.trim()) {
      setError('Please enter a Target Webpage URL or paste HTML source code.');
      return;
    }

    let currentBase64 = screenshotBase64;
    let currentDocText = referenceDocText;

    if (!currentBase64 && !currentDocText && referenceUrl.trim()) {
      const resolved = await resolveReferenceLink(referenceUrl);
      if (!resolved) return;
      if (resolved.type === 'awesome') currentBase64 = resolved.value;
      else currentDocText = resolved.value;
    }

    if (!currentBase64 && !currentDocText) {
      setError('Please provide a reference: an Awesome Screenshot URL, a Google Doc link, or an uploaded screenshot image.');
      return;
    }

    const sanitizedUrl = normalizeUrl(url);
    if (sanitizedUrl !== url.trim()) setUrl(sanitizedUrl);

    setIsLoading(true);
    setError(null);
    setReport(null);
    setShowFaqJson(false);

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
      const finalImagePayload = currentBase64 ? await compressImage(currentBase64) : undefined;

      let response = await fetch('/api/content-checker/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: sanitizedUrl || undefined,
          rawHtml: rawHtml.trim() || undefined,
          image: finalImagePayload,
          referenceText: currentDocText || undefined,
          contentSelector: contentSelector.trim() || undefined,
          selectedChecks: Array.from(selectedChecks),
        })
      });

      let responseText = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(responseText);
      } catch {
        // ignore JSON parse error for initial try
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

  const hasReference = !!(screenshotBase64 || referenceDocText || referenceUrl.trim());
  const readyToSelectChecks = !!(url.trim() || rawHtml.trim()) && hasReference;

  const filteredComparisons = report
    ? report.bodyContent.mismatches.filter((m) => selectedChecks.has(categoryGroup(m.category)))
    : [];
  const filteredMismatchCount = filteredComparisons.filter((m) => m.status !== 'match').length;
  // Mismatches need full expected/actual detail; matches are just noise unless someone asks to see them.
  const realMismatches = filteredComparisons.filter((m) => m.status !== 'match');
  const plainMatches = filteredComparisons.filter((m) => m.status === 'match');
  const titleOrDescriptionMismatch = !!report && (
    (selectedChecks.has('title') && (!report.seo.urlMatches || !report.seo.titleMatches || !report.seo.descriptionMatches))
  );
  const faqMismatch = !!report?.faqSchema && selectedChecks.has('faq') &&
    report.faqSchema.status !== 'match' && report.faqSchema.status !== 'not_present';
  const imageMismatch = !!report?.featureImage && selectedChecks.has('image') &&
    report.featureImage.applicable && !report.featureImage.matches;

  return (
    <div className="space-y-6 text-slate-900">
      {/* Tool Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-600 rounded-xl text-white shadow-xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Content Audit
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
              <Globe className="h-4 w-4 text-blue-600" />
              <span>Target Webpage URL</span>
            </label>
            <button
              type="button"
              onClick={() => setShowHtmlPaste(!showHtmlPaste)}
              className="text-[11px] text-blue-600 hover:underline font-semibold cursor-pointer"
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
                className="w-full pl-10 pr-3 py-2.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white shadow-2xs"
              />
            </div>
          ) : (
            <textarea
              rows={4}
              placeholder="Paste complete HTML source code here..."
              value={rawHtml}
              onChange={(e) => setRawHtml(e.target.value)}
              className="w-full p-3 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white shadow-2xs"
            />
          )}
        </div>

        {/* Advanced Manual Content Selector (Fix 16) */}
        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            {showAdvanced ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600" />
            <span>Advanced: Manual Content Selector</span>
            {contentSelector.trim() && (
              <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                {contentSelector.trim()}
              </span>
            )}
          </button>

          {showAdvanced && (
            <div className="mt-2.5 p-3 bg-slate-50/70 border border-slate-200 rounded-xl space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                CSS Content Selector (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. main article, #content, or .entry-content (Default: Auto-Detect)"
                value={contentSelector}
                onChange={(e) => setContentSelector(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-2xs"
              />
              <p className="text-[11px] text-slate-500">
                Scope auditing strictly to this CSS selector. If provided and not found in the DOM, an explicit error will be reported instead of silently falling back.
              </p>
            </div>
          )}
        </div>

        {/* Screenshot / Reference Input */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Link2 className="h-4 w-4 text-blue-600" />
              <span>Reference Link (Awesome Screenshot or Google Doc)</span>
            </label>
            {referenceDocText ? (
              <div className="flex items-center justify-between p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl">
                <span className="text-xs font-bold text-emerald-900 truncate">
                  Reference Doc Loaded ({referenceDocText.length.toLocaleString()} chars)
                </span>
                <button type="button" onClick={resetReferenceDoc} className="px-2 py-1 text-xs font-medium text-rose-700 bg-white border border-rose-200 rounded-lg cursor-pointer shrink-0">
                  Change
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste an awesomescreenshot.com or docs.google.com share link..."
                  value={referenceUrl}
                  onChange={(e) => setReferenceUrl(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => resolveReferenceLink()}
                  disabled={isResolvingReference || !referenceUrl.trim()}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-xl shadow-2xs cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  {isResolvingReference ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <span>Fetch</span>}
                </button>
              </div>
            )}
            {referenceError && <p className="text-[11px] text-rose-600 font-medium">{referenceError}</p>}
            <p className="text-[11px] text-slate-500">Google Docs must be shared as "Anyone with the link can view".</p>
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

          {readyToSelectChecks && (
            <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-xl space-y-2.5">
              <span className="text-xs font-bold text-blue-950">What do you want to check?</span>
              <div className="flex flex-wrap gap-2">
                {CHECK_CATEGORIES.map((cat) => {
                  const active = selectedChecks.has(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCheck(cat.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={runScreenshotAnalysis}
            disabled={isLoading || !readyToSelectChecks || selectedChecks.size === 0}
            className="w-full py-3 px-4 rounded-xl font-bold text-xs tracking-tight flex items-center justify-center gap-2 transition-all shadow-2xs bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-blue-200" />
                <span>{loadingStep || 'Comparing Webpage with Screenshot...'}</span>
              </>
            ) : (
              <>
                <FileSearch className="h-4 w-4 text-blue-200" />
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
      {report && (() => {
        const issues = report.issues || [];
        const criticalCount = issues.filter((i) => i.severity === 'CRITICAL').length;
        const structuralCount = issues.filter(
          (i) =>
            i.category.toLowerCase().includes('heading') ||
            i.category.toLowerCase().includes('structure') ||
            i.message.toLowerCase().includes('structure') ||
            i.message.toLowerCase().includes('level') ||
            i.message.toLowerCase().includes('order')
        ).length;
        const contentDiffCount = issues.filter((i) => i.severity === 'HIGH' || i.severity === 'MEDIUM').length;
        const minorDiffCount = issues.filter((i) => i.severity === 'LOW' || i.severity === 'INFO').length;
        const passedCount =
          plainMatches.length +
          (report.seo?.urlMatches ? 1 : 0) +
          (report.seo?.titleMatches ? 1 : 0) +
          (report.seo?.descriptionMatches ? 1 : 0);

        const statusInfo = getStatusBadge(report.status);

        return (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
            {/* Primary Audit Result Banner (Fix 32) */}
            <div className={`border rounded-2xl p-5 ${statusInfo.cardBg} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}>
              <div className="flex items-center gap-4">
                <div
                  className={`shrink-0 flex flex-col items-center justify-center h-16 w-16 rounded-2xl border-2 font-black text-lg leading-none ${
                    report.overallScore >= 90
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : report.overallScore >= 70
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}
                >
                  <span>{report.overallScore}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wide opacity-70 mt-0.5">Score</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black tracking-wide ${statusInfo.badgeBg}`}>
                      {statusInfo.label}
                    </span>
                    {report.status === 'UNVERIFIED' && (
                      <span className="text-xs font-bold text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded">
                        Low Extraction Confidence
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-slate-700">{statusInfo.desc}</p>
                  {report.summary && <p className="text-xs text-slate-600 leading-relaxed pt-1">{report.summary}</p>}
                </div>
              </div>

              {/* Extraction Quality Badges */}
              {report.extraction && (
                <div className="shrink-0 flex sm:flex-col gap-1.5 text-right sm:items-end">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    report.extraction.page.confidence === 'HIGH'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : report.extraction.page.confidence === 'LOW'
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>
                    Webpage: {report.extraction.page.confidence}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    report.extraction.reference.confidence === 'HIGH'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : report.extraction.reference.confidence === 'LOW'
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>
                    Reference: {report.extraction.reference.confidence}
                  </span>
                </div>
              )}
            </div>

            {/* Issue Breakdown Summary Counters (Fix 33) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                <span className="text-[10px] font-bold text-rose-700 uppercase block">Critical</span>
                <span className="text-lg font-black text-rose-900">{criticalCount}</span>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                <span className="text-[10px] font-bold text-amber-700 uppercase block">Structural</span>
                <span className="text-lg font-black text-amber-900">{structuralCount}</span>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
                <span className="text-[10px] font-bold text-blue-700 uppercase block">Content Diffs</span>
                <span className="text-lg font-black text-blue-900">{contentDiffCount}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[10px] font-bold text-slate-600 uppercase block">Minor Diffs</span>
                <span className="text-lg font-black text-slate-800">{minorDiffCount}</span>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">Passed Checks</span>
                <span className="text-lg font-black text-emerald-900">{passedCount}</span>
              </div>
            </div>

            {/* Extraction Diagnostics & Quality Validation Panel (Fix 35) */}
            {report.extraction && (
              <div className="border border-slate-200 rounded-xl bg-slate-50/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowDiagnostics(!showDiagnostics)}
                  className="w-full px-4 py-3 bg-slate-100/70 hover:bg-slate-200/50 flex items-center justify-between cursor-pointer transition-colors text-xs font-bold text-slate-800"
                >
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-600" />
                    <span>Extraction Diagnostics & Quality Validation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        report.extraction.page.confidence === 'HIGH' && report.extraction.reference.confidence === 'HIGH'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : report.extraction.page.confidence === 'LOW' || report.extraction.reference.confidence === 'LOW'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      Webpage: {report.extraction.page.confidence} | Ref: {report.extraction.reference.confidence}
                    </span>
                    {showDiagnostics ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
                  </div>
                </button>

                {showDiagnostics && (
                  <div className="p-4 space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Target Webpage Diagnostics */}
                      <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                        <h4 className="font-bold text-slate-900 flex items-center justify-between">
                          <span>Webpage Extraction</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            Score: {report.extraction.page.confidenceScore}%
                          </span>
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                          <div><span className="text-slate-400">Fetch Method:</span> <strong className="text-slate-700 uppercase">{report.extraction.page.fetchMethod}</strong></div>
                          <div><span className="text-slate-400">HTTP Status:</span> <strong className="text-slate-700">{report.extraction.page.httpStatus ?? 'N/A'}</strong></div>
                          <div><span className="text-slate-400">HTML Size:</span> <strong className="text-slate-700">{(report.extraction.page.htmlSize / 1024).toFixed(1)} KB</strong></div>
                          <div><span className="text-slate-400">Rendered DOM:</span> <strong className="text-slate-700">{report.extraction.page.rendered ? 'Yes (Playwright)' : 'No (Raw HTTP)'}</strong></div>
                          <div><span className="text-slate-400">Main Content Blocks:</span> <strong className="text-slate-700">{report.extraction.page.detectedMainContentBlocks}</strong></div>
                          <div><span className="text-slate-400">Detected Headings:</span> <strong className="text-slate-700">{report.extraction.page.detectedHeadings}</strong></div>
                          <div><span className="text-slate-400">Detected Paragraphs:</span> <strong className="text-slate-700">{report.extraction.page.detectedParagraphs}</strong></div>
                          <div><span className="text-slate-400">Detected Tables:</span> <strong className="text-slate-700">{report.extraction.page.detectedTables}</strong></div>
                        </div>
                        {report.extraction.page.notes.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 space-y-1">
                            {report.extraction.page.notes.map((note, idx) => (
                              <p key={idx} className="text-[11px] text-slate-500 italic">• {note}</p>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Reference Extraction Diagnostics */}
                      <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                        <h4 className="font-bold text-slate-900 flex items-center justify-between">
                          <span>Reference Extraction</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            Score: {report.extraction.reference.confidenceScore}%
                          </span>
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                          <div><span className="text-slate-400">Source:</span> <strong className="text-slate-700 uppercase">{report.extraction.reference.source}</strong></div>
                          <div><span className="text-slate-400">Characters:</span> <strong className="text-slate-700">{report.extraction.reference.characterCount.toLocaleString()}</strong></div>
                          <div><span className="text-slate-400">Blocks:</span> <strong className="text-slate-700">{report.extraction.reference.blockCount}</strong></div>
                          <div><span className="text-slate-400">Lines:</span> <strong className="text-slate-700">{report.extraction.reference.lineCount}</strong></div>
                          {report.extraction.reference.ocrConfidence !== undefined && (
                            <div><span className="text-slate-400">OCR Confidence:</span> <strong className="text-slate-700">{report.extraction.reference.ocrConfidence.toFixed(1)}%</strong></div>
                          )}
                          {report.extraction.reference.tileCount !== undefined && (
                            <div><span className="text-slate-400">OCR Tiles:</span> <strong className="text-slate-700">{report.extraction.reference.tileCount}</strong></div>
                          )}
                        </div>
                        {report.extraction.reference.unverifiedFields.length > 0 && (
                          <div className="pt-2 border-t border-slate-100">
                            <span className="text-[11px] font-semibold text-amber-700 block">Unverified Fields:</span>
                            <p className="text-[11px] text-amber-800">{report.extraction.reference.unverifiedFields.join(', ')}</p>
                          </div>
                        )}
                        {report.extraction.reference.notes.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 space-y-1">
                            {report.extraction.reference.notes.map((note, idx) => (
                              <p key={idx} className="text-[11px] text-slate-500 italic">• {note}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {report.recommendations.length > 0 && (
              <div className="border border-amber-200 bg-amber-50/60 rounded-xl p-4 space-y-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-amber-900 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" /> Recommendations
                </h3>
                <ul className="space-y-1.5">
                  {report.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-xs text-amber-900 flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-500 shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* URL, Title & Description — side by side against the reference's header block */}
            {selectedChecks.has('title') && (
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2 border-b border-slate-200/80 pb-2">
                  <FileText className="h-4 w-4 text-blue-600" /> URL, Title & Description
                </h3>
                <div className="space-y-2">
                  {[
                    { label: 'URL', expected: report.seo.expectedUrl, actual: report.seo.actualUrl, matches: report.seo.urlMatches },
                    { label: 'Title', expected: report.seo.expectedTitle, actual: report.seo.actualTitle, matches: report.seo.titleMatches },
                    { label: 'Meta Description', expected: report.seo.expectedDescription, actual: report.seo.actualDescription, matches: report.seo.descriptionMatches }
                  ].map((row) => (
                    <div key={row.label} className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="px-2.5 py-1.5 bg-slate-100 text-[11px] font-bold text-slate-700 flex items-center justify-between">
                        <span>{row.label}</span>
                        {row.matches ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-amber-600" />
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                        <div className="p-2.5 bg-white text-xs">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Expected (Reference)</span>
                          <p className="text-slate-700">{row.expected}</p>
                        </div>
                        <div className="p-2.5 bg-white text-xs">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Actual (Webpage)</span>
                          <p className="text-slate-700">{row.actual}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Headings Hierarchy & Structure Audit (Fix 3 & Fix 4) */}
            {selectedChecks.has('headings') && report.headings && report.headings.matches.length > 0 && (
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <Heading className="h-4 w-4 text-blue-600" /> Heading Structure & Copy Audit
                  </h3>
                  <span className="text-[11px] font-semibold text-slate-600">
                    {report.headings.analysis}
                  </span>
                </div>

                <div className="space-y-2">
                  {report.headings.matches.map((h, idx) => {
                    const isMatch = h.status === 'match';
                    const copyOk = h.copyStatus === 'EXACT' || h.status === 'match';
                    const structOk = !h.structureStatus || h.structureStatus === 'EXACT';

                    return (
                      <div
                        key={idx}
                        className={`border rounded-lg overflow-hidden ${
                          isMatch ? 'border-slate-200 bg-white' : 'border-rose-200 bg-rose-50/30'
                        }`}
                      >
                        <div
                          className={`px-3 py-1.5 text-[11px] font-bold flex flex-wrap items-center justify-between gap-2 ${
                            isMatch ? 'bg-slate-100 text-slate-800' : 'bg-rose-100/70 text-rose-900'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white font-mono text-[10px] font-extrabold uppercase">
                              {h.expectedLevel ? `H${h.expectedLevel}` : (h.level ? h.level.toUpperCase() : 'H2')}
                            </span>
                            <span>Heading {idx + 1}</span>
                            {h.actualLevel && h.expectedLevel && h.actualLevel !== h.expectedLevel && (
                              <span className="text-[10px] text-rose-700 font-semibold">
                                (Rendered as H{h.actualLevel})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                copyOk
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              Copy: {copyOk ? 'MATCH' : (h.copyStatus || 'MISMATCH')}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                structOk
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              Structure: {structOk ? 'MATCH' : (h.structureStatus || 'FAIL')}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                          <div className="p-2.5 bg-white text-xs">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                              Expected ({h.expectedLevel ? `H${h.expectedLevel}` : 'Heading'})
                            </span>
                            <p className="text-slate-800 font-medium">{h.expectedText}</p>
                          </div>
                          <div className="p-2.5 bg-white text-xs">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                              Actual ({h.actualLevel ? `H${h.actualLevel}` : 'DOM'})
                            </span>
                            <p className="text-slate-800 font-medium">
                              {h.actualText || <span className="text-rose-500 italic">(missing from page)</span>}
                            </p>
                          </div>
                        </div>

                        {h.comment && !isMatch && (
                          <div className="px-2.5 py-1.5 bg-rose-50/60 border-t border-rose-100 text-[11px] text-rose-800">
                            {h.comment}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Paragraph-to-paragraph, list-to-list, table-to-table Content Comparison */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-600" /> Content Comparison
                </h3>
                {filteredComparisons.length > 0 && (
                  <span className="text-[11px] font-semibold flex items-center gap-2.5">
                    <span className="text-emerald-700">{filteredComparisons.length - filteredMismatchCount} matched</span>
                    {filteredMismatchCount > 0 && <span className="text-rose-700">{filteredMismatchCount} mismatched</span>}
                  </span>
                )}
              </div>

              {filteredComparisons.length === 0 ? (
                <p className="text-xs text-slate-600 leading-relaxed">No content in the categories you checked.</p>
              ) : realMismatches.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50/70 border border-emerald-200 rounded-lg px-3 py-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Every checked item matches the reference.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {realMismatches.map((item, idx) => (
                    <div key={idx} className="border border-rose-200 rounded-lg overflow-hidden bg-white">
                      <div className="px-3 py-1.5 bg-rose-50 text-[11px] font-bold text-rose-800 flex items-center justify-between gap-1.5 border-b border-rose-100">
                        <div className="flex items-center gap-1.5">
                          <XCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>{item.category}</span>
                        </div>
                        {item.comment && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-100 text-rose-900">
                            {item.comment}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                        <div className="p-2.5 bg-white text-xs">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Expected (Reference)</span>
                          <p className="text-slate-700">{item.expected}</p>
                        </div>
                        <div className="p-2.5 bg-white text-xs">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Actual (Webpage)</span>
                          <p className="text-slate-700">{item.actual}</p>
                        </div>
                      </div>
                      {item.difference && (
                        <div className="p-2.5 bg-slate-900 border-t border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Word-Level Diff</span>
                          {renderDiff(item.difference)}
                        </div>
                      )}
                      {item.evidence && (
                        <div className="px-2.5 py-1 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 font-mono">
                          <span className="font-semibold text-slate-600">Evidence:</span> {item.evidence}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {plainMatches.length > 0 && (
                <div className="pt-1 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setShowAllMatches((v) => !v)}
                    className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer flex items-center gap-1 pt-2"
                  >
                    {showAllMatches ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    {showAllMatches ? 'Hide' : 'Show'} {plainMatches.length} matched item{plainMatches.length === 1 ? '' : 's'}
                  </button>
                  {showAllMatches && (
                    <div className="space-y-1 pt-2">
                      {plainMatches.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">{item.category}</span>
                          <span className="text-xs text-slate-600 truncate">{item.actual}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

          {/* Feature Image — expected (from the doc) vs actual (og:image/twitter:image/first <img>) */}
          {selectedChecks.has('image') && report.featureImage && report.featureImage.applicable && (
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <FileImage className="h-4 w-4 text-blue-600" /> Feature Image
                </h3>
                {report.featureImage.matches ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-amber-600" />
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{report.featureImage.analysis}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                <div className="p-2.5 bg-white text-xs space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Expected (Reference)</span>
                  {/^https?:\/\//i.test(report.featureImage.expected) && (
                    <img src={report.featureImage.expected} alt="Expected feature" className="h-16 w-16 object-cover rounded-lg border border-slate-200" />
                  )}
                  <p className="text-slate-700 break-all">{report.featureImage.expected}</p>
                </div>
                <div className="p-2.5 bg-white text-xs space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Actual (Webpage)</span>
                  {/^https?:\/\//i.test(report.featureImage.actual) && (
                    <img src={report.featureImage.actual} alt="Actual feature" className="h-16 w-16 object-cover rounded-lg border border-slate-200" />
                  )}
                  <p className="text-slate-700 break-all">{report.featureImage.actual}</p>
                </div>
              </div>
            </div>
          )}

          {/* FAQ Schema — present/absent, plus an expandable JSON-LD view checked against the reference doc */}
          {selectedChecks.has('faq') && report.faqSchema && (
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Code className="h-4 w-4 text-blue-600" /> FAQ Schema
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                  report.faqSchema.status === 'match'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : report.faqSchema.status === 'not_present'
                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {report.faqSchema.present ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  <span>{report.faqSchema.present ? 'Present' : 'Not Present'}</span>
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{report.faqSchema.analysis}</p>

              {report.faqSchema.mismatchDetails.length > 0 && (
                <ul className="space-y-1.5">
                  {report.faqSchema.mismatchDetails.map((detail, idx) => (
                    <li key={idx} className="text-xs text-amber-900 bg-amber-50/60 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              )}

              {report.faqSchema.present && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowFaqJson(!showFaqJson)}
                    className="w-full px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-[11px] font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {showFaqJson ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    <span>View FAQPage JSON-LD</span>
                  </button>
                  {showFaqJson && (
                    <pre className="p-3 bg-slate-950 text-slate-200 overflow-x-auto font-mono text-[11px] leading-relaxed">{report.faqSchema.rawJson}</pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      );
    })()}
    </div>
  );
}
