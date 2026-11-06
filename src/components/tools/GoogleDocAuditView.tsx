import React, { useState } from 'react';
import {
  Globe,
  FileText,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Filter,
} from 'lucide-react';
import type {
  ContentAuditReport,
  ElementComparisonResult,
  NormalizedDocument,
  NormalizedElement,
} from '../../../server/content-auditor/types/normalized';
import type { MetaCheck, LinkCheck } from '../../../server/content-auditor/types/report';
import { computeWordDiff } from '../../../server/content-auditor/comparison/diff';

interface StructuredElementContentProps {
  tag: string;
  text: string;
  items?: string[];
  rows?: string[][];
  side?: 'reference' | 'website';
  counterpart?: { tag: string; text: string; items?: string[]; rows?: string[][] };
}

const BADGE_TONES = {
  ok: 'bg-acc-green text-ink border-ink',
  warn: 'bg-acc-amber text-ink border-ink',
  bad: 'bg-acc-rose text-ink border-ink',
};

function StatusBadge({ tone, label }: { tone: keyof typeof BADGE_TONES; label: string }) {
  return (
    <span className={`px-2 py-0.5 text-[11px] font-bold uppercase rounded-md border ${BADGE_TONES[tone]}`}>{label}</span>
  );
}

const META_TONE: Record<MetaCheck['status'], keyof typeof BADGE_TONES> = {
  MATCH: 'ok',
  NEAR_MATCH: 'warn',
  MISMATCH: 'bad',
  MISSING_ON_PAGE: 'bad',
  NOT_IN_DOC: 'warn',
};

const META_LABEL: Record<MetaCheck['status'], string> = {
  MATCH: 'Match',
  NEAR_MATCH: 'Near match',
  MISMATCH: 'Mismatch',
  MISSING_ON_PAGE: 'Missing on page',
  NOT_IN_DOC: 'Not in doc',
};

const LINK_TONE: Record<LinkCheck['status'], keyof typeof BADGE_TONES> = {
  MATCH: 'ok',
  ANCHOR_DIFFERS: 'warn',
  WRONG_URL: 'bad',
  NOT_LINKED: 'bad',
  MISSING: 'bad',
};

const LINK_LABEL: Record<LinkCheck['status'], string> = {
  MATCH: 'Match',
  ANCHOR_DIFFERS: 'Anchor differs',
  WRONG_URL: 'Wrong URL',
  NOT_LINKED: 'Not linked',
  MISSING: 'Missing',
};

const DIFF_HIGHLIGHT_STYLE = {
  reference: 'bg-rose-200 text-rose-900 rounded px-0.5',
  website: 'bg-amber-200 text-amber-900 rounded px-0.5',
};

function HighlightedText({
  text,
  counterpartText,
  side,
}: {
  text: string;
  counterpartText?: string;
  side: 'reference' | 'website';
}) {
  if (counterpartText === undefined) return <>{text}</>;

  const words =
    side === 'reference'
      ? computeWordDiff(text, counterpartText, true).filter((word) => !word.added)
      : computeWordDiff(counterpartText, text, true).filter((word) => !word.removed);

  return (
    <>
      {words.map((word, index) => (
        <React.Fragment key={index}>
          {index > 0 && ' '}
          {word.added || word.removed ? (
            <mark className={DIFF_HIGHLIGHT_STYLE[side]}>{word.value}</mark>
          ) : (
            word.value
          )}
        </React.Fragment>
      ))}
    </>
  );
}

function pairListItemsForDiff(ownItems: string[], otherItems: string[]): string[] {
  const counterparts: string[] = new Array(ownItems.length).fill('');
  const claimedOtherIndexes = new Set<number>();
  const unmatchedOwnIndexes: number[] = [];

  ownItems.forEach((ownItem, ownIndex) => {
    const identicalIndex = otherItems.findIndex(
      (otherItem, otherIndex) => !claimedOtherIndexes.has(otherIndex) && otherItem === ownItem
    );
    if (identicalIndex >= 0) {
      claimedOtherIndexes.add(identicalIndex);
      counterparts[ownIndex] = ownItem;
    } else {
      unmatchedOwnIndexes.push(ownIndex);
    }
  });

  const unclaimedOtherItems = otherItems.filter((_, otherIndex) => !claimedOtherIndexes.has(otherIndex));
  unmatchedOwnIndexes.forEach((ownIndex, position) => {
    counterparts[ownIndex] = unclaimedOtherItems[position] ?? '';
  });

  return counterparts;
}

function StructuredElementContent({
  tag,
  text,
  items,
  rows,
  side = 'reference',
  counterpart,
}: StructuredElementContentProps) {
  const isComparable = counterpart !== undefined;

  if ((tag === 'ul' || tag === 'ol') && items?.length) {
    const ListTag = tag;
    const listStyle = tag === 'ol' ? 'list-decimal' : 'list-disc';
    const counterpartItems = isComparable && counterpart.items ? pairListItemsForDiff(items, counterpart.items) : undefined;
    return (
      <ListTag className={`${listStyle} pl-5 space-y-1 text-slate-800 font-medium leading-relaxed`}>
        {items.map((listItemText, index) => (
          <li key={index}>
            <HighlightedText text={listItemText} counterpartText={counterpartItems?.[index]} side={side} />
          </li>
        ))}
      </ListTag>
    );
  }

  if (tag === 'table' && rows?.length) {
    const counterpartRows = isComparable ? counterpart.rows : undefined;
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-slate-800 font-medium">
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cellText, cellIndex) => (
                  <td key={cellIndex} className="border border-slate-200 px-2 py-1 align-top">
                    <HighlightedText
                      text={cellText}
                      counterpartText={counterpartRows ? counterpartRows[rowIndex]?.[cellIndex] ?? '' : undefined}
                      side={side}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <p className="text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">
      <HighlightedText text={text} counterpartText={counterpart?.text} side={side} />
    </p>
  );
}

export async function runDocAudit(googleDocUrl: string, targetUrl: string, contentSelector?: string): Promise<ContentAuditReport> {
  const res = await fetch('/api/content-checker/audit-doc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      googleDocUrl: googleDocUrl.trim(),
      targetUrl: targetUrl.trim(),
      contentSelector: contentSelector?.trim() || undefined,
    }),
  });
  // A proxy/timeout page or a crashed server returns HTML, not JSON
  const data = await res.json().catch(() => {
    throw new Error(`Server returned an unexpected response (HTTP ${res.status}). Please try again.`);
  });
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Content audit failed.');
  }
  return data.report;
}

export default function GoogleDocAuditView() {
  const [docUrl, setDocUrl] = useState<string>('');
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [contentSelector, setContentSelector] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ContentAuditReport | null>(null);

  const handleRunAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docUrl.trim()) {
      setError('Please provide a Google Doc URL.');
      return;
    }
    if (!targetUrl.trim()) {
      setError('Please provide a target Website URL.');
      return;
    }

    setError(null);
    setIsLoading(true);
    setReport(null);

    const steps = [
      'Fetching public document from Google Docs API...',
      'Locating first H1 and normalizing content...',
      'Fetching and rendering live website...',
      'Extracting semantic DOM structure from first H1...',
      'Executing deterministic comparison...',
    ];

    let stepIdx = 0;
    setLoadingStep(steps[0]);
    const interval = setInterval(() => {
      if (stepIdx < steps.length - 1) {
        stepIdx++;
        setLoadingStep(steps[stepIdx]);
      }
    }, 1200);

    try {
      const result = await runDocAudit(docUrl, targetUrl, contentSelector);
      clearInterval(interval);
      setReport(result);
    } catch (err: any) {
      clearInterval(interval);
      setError(err.message || 'An unexpected error occurred during the content audit.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Form */}
      {/* noValidate: the server accepts bare domains and doc IDs that type="url" would reject */}
      <form
        noValidate
        onSubmit={handleRunAudit}
        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Reference Google Doc URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-blue-600" />
              <span>Reference Google Doc URL</span>
            </label>
            <input
              type="url"
              placeholder="https://docs.google.com/document/d/.../edit"
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <span>Google Doc must be shared as:</span>
              <strong className="text-slate-700">Anyone with the link &rarr; Viewer</strong>
            </p>
          </div>

          {/* Target Website URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-blue-600" />
              <span>Target Website URL</span>
            </label>
            <input
              type="url"
              placeholder="https://example.com/page"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            <p className="text-[11px] text-slate-500">
              Audit starts from the page's first <strong>&lt;h1&gt;</strong>. Global headers and footers are ignored.
            </p>
          </div>
        </div>

        {/* Collapsible Advanced Options */}
        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 min-h-8 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            {showAdvanced ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <span>Advanced: Custom Content Selector (Optional)</span>
          </button>

          {showAdvanced && (
            <div className="mt-2 space-y-1">
              <input
                type="text"
                placeholder="e.g. main, article, .entry-content, #content"
                value={contentSelector}
                onChange={(e) => setContentSelector(e.target.value)}
                disabled={isLoading}
                className="w-full max-w-md px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-400">
                Optional CSS selector to scope website extraction to a specific container.
              </p>
            </div>
          )}
        </div>

        {/* Action Button & Loading Indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          {isLoading ? (
            <div className="flex items-center gap-2.5 text-xs text-blue-700 bg-blue-50 px-3.5 py-2 rounded-xl border border-blue-200">
              <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
              <span className="font-medium">{loadingStep}</span>
            </div>
          ) : (
            <div />
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition-colors cursor-pointer ml-auto"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Run Content Audit</span>
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold whitespace-pre-wrap">{error}</p>
            {error.includes('Heading 1') && (
              <p className="text-[11px] text-rose-700">
                Ensure your Google Doc has at least one heading formatted with the built-in
                Google Docs "Heading 1" paragraph style.
              </p>
            )}
            {error.includes('Anyone with the link') && (
              <p className="text-[11px] text-rose-700 font-medium">
                In Google Docs, click the blue "Share" button at top-right &rarr; General access &rarr; change to "Anyone with the link" as "Viewer".
              </p>
            )}
          </div>
        </div>
      )}

      {report && <AuditReportView report={report} />}
    </div>
  );
}

type PageRow = { label: string; tone: keyof typeof BADGE_TONES; status: string; doc: React.ReactNode; live: React.ReactNode };

// URL, meta title, meta description and canonical in one table: each value shown once, doc next to live page
function PageVsDocCard({ report }: { report: ContentAuditReport }) {
  const missing = (text: string) => <em className="text-slate-400 font-normal">{text}</em>;
  const { urlCheck, metaChecks = [], page } = report;
  const rows: PageRow[] = [];
  if (urlCheck) {
    rows.push({
      label: 'URL',
      tone: urlCheck.status === 'MATCH' ? 'ok' : urlCheck.status === 'MISMATCH' ? 'bad' : 'warn',
      status: urlCheck.status === 'MATCH' ? 'Match' : urlCheck.status === 'MISMATCH' ? 'Mismatch' : 'Not in doc',
      doc: urlCheck.expected || missing('No URL or slug in the doc'),
      live: (
        <a href={urlCheck.actual} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          {urlCheck.actual}
        </a>
      ),
    });
  }
  metaChecks.forEach((m) => {
    const differs = m.status !== 'MATCH' && !!m.expected && !!m.actual;
    rows.push({
      label: m.field === 'title' ? 'Meta Title' : 'Meta Description',
      tone: META_TONE[m.status],
      status: META_LABEL[m.status],
      doc: m.expected ? <HighlightedText text={m.expected} counterpartText={differs ? m.actual : undefined} side="reference" /> : missing('Not in the doc'),
      live: m.actual ? <HighlightedText text={m.actual} counterpartText={differs ? m.expected : undefined} side="website" /> : missing('Not on the page'),
    });
  });
  if (page?.canonical) {
    const canonicalMatches = urlCheck?.canonicalMatches;
    rows.push({
      label: 'Canonical',
      tone: canonicalMatches === false ? 'warn' : 'ok',
      status: canonicalMatches === false ? 'Differs' : canonicalMatches ? 'Match' : 'Found',
      doc: missing('Checked against the doc URL'),
      live: page.canonical,
    });
  }
  if (!rows.length) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs text-xs">
      <h4 className="text-sm font-bold text-slate-900 mb-2">Page vs Doc</h4>
      <div className="hidden md:grid grid-cols-[8.5rem_7rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-4 pb-1.5 text-[10px] uppercase font-bold text-slate-400">
        <span>Field</span>
        <span>Status</span>
        <span>Doc</span>
        <span>Live page</span>
      </div>
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[auto_minmax(0,1fr)] md:grid-cols-[8.5rem_7rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-4 gap-y-1 py-2.5 border-t border-slate-100 items-start">
          <span className="font-bold text-slate-500 uppercase text-[10px] pt-1">{row.label}</span>
          <span>
            <StatusBadge tone={row.tone} label={row.status} />
          </span>
          <span className="col-span-2 md:col-span-1 text-slate-800 font-medium break-words [overflow-wrap:anywhere]">
            <span className="md:hidden text-slate-400 font-normal">Doc: </span>
            {row.doc}
          </span>
          <span className="col-span-2 md:col-span-1 text-slate-800 font-medium break-words [overflow-wrap:anywhere]">
            <span className="md:hidden text-slate-400 font-normal">Live: </span>
            {row.live}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AuditReportView({ report }: { report: ContentAuditReport }) {
  const [filter, setFilter] = useState<'all' | 'issues' | 'pass'>('all');
  const [activeTab, setActiveTab] = useState<'comparison' | 'reference' | 'website'>('comparison');

  const filteredResults = report.results.filter((item) => {
    if (filter === 'issues') return item.status !== 'PASS';
    if (filter === 'pass') return item.status === 'PASS';
    return true;
  });

  return (
    <div className="space-y-6">
      {report.notices?.map((notice, i) => (
        <div key={i} role="status" className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-2xl p-4 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
          <p className="font-medium">{notice}</p>
        </div>
      ))}

      {/* Summary Banner Card */}
      <div
        className={`border rounded-2xl p-5 shadow-2xs ${
          report.summary.status === 'PASS'
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
            : report.summary.status === 'PASS_WITH_WARNINGS'
            ? 'bg-amber-50/70 border-amber-200 text-amber-900'
            : 'bg-rose-50/70 border-rose-200 text-rose-900'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {report.summary.status === 'PASS' ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-700 shrink-0" />
            ) : report.summary.status === 'PASS_WITH_WARNINGS' ? (
              <AlertTriangle className="h-6 w-6 text-amber-700 shrink-0" />
            ) : (
              <XCircle className="h-6 w-6 text-rose-600 shrink-0" />
            )}
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                {report.summary.status === 'PASS'
                  ? 'AUDIT PASS — Strict Match'
                  : report.summary.status === 'PASS_WITH_WARNINGS'
                  ? 'PASS WITH WARNINGS — Minor Variations'
                  : 'AUDIT FAIL — Differences Detected'}
              </h3>
              <p className="text-xs opacity-80 mt-0.5">
                {report.summary.status === 'PASS'
                  ? 'All reference headings, paragraphs, lists, and tables match the live webpage structure.'
                  : report.summary.status === 'PASS_WITH_WARNINGS'
                  ? 'Content matches the doc. Only capitalisation, punctuation, HTML tags or element order differ.'
                  : 'Mismatched copy or missing elements were identified between the Google Doc and the live site.'}
              </p>
            </div>
          </div>

          {/* Metric badges: one-word labels so they never wrap; the full meaning is on hover */}
          <dl className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center shrink-0">
            {[
              { label: 'Total', value: report.summary.total, hint: 'Elements in the doc', tone: 'border-slate-200/80 text-slate-800' },
              { label: 'Passed', value: report.summary.passed, hint: 'Same text and same HTML tag', tone: 'border-emerald-200 text-emerald-700' },
              { label: 'Tag', value: report.summary.wrongTag, hint: 'Wrong tag: text matches, HTML tag differs (e.g. H2 vs H3)', tone: 'border-amber-200 text-amber-700' },
              { label: 'Order', value: report.summary.wrongOrder, hint: 'Wrong order: text is on the page, in a different position', tone: 'border-amber-200 text-amber-700' },
              { label: 'Mismatch', value: report.summary.contentMismatch, hint: 'Text differs from the doc', tone: 'border-rose-200 text-rose-700' },
              { label: 'Missing', value: report.summary.missing, hint: 'Not found on the page', tone: 'border-red-200 text-red-700' },
            ].map(({ label, value, hint, tone }) => (
              <div key={label} title={hint} className={`min-w-[4.75rem] bg-white/80 border rounded-xl px-2 py-1.5 shadow-2xs ${tone}`}>
                <dt className="text-[10px] uppercase font-bold whitespace-nowrap opacity-80">{label}</dt>
                <dd className="text-base font-bold leading-tight tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Doc vs page checks: one Page vs Doc table, the small checks side by side, Links full width */}
      <div className="space-y-4">
      <PageVsDocCard report={report} />

      {/* auto-fit: two or three small cards always share the full width, no empty column */}
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))]">
      {/* FAQPage JSON-LD on the live page: present and valid */}
      {report.faqSchema && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-bold text-slate-900">FAQ Schema</h4>
            {report.faqSchema.present || report.faqSchema.errors.length ? (
              <>
                <StatusBadge tone="ok" label="Present" />
                <StatusBadge tone={report.faqSchema.valid ? 'ok' : 'bad'} label={report.faqSchema.valid ? 'Valid' : 'Invalid'} />
                <span className="text-slate-500">{report.faqSchema.questionCount} question(s)</span>
              </>
            ) : (
              <>
                <StatusBadge tone="warn" label="Not present" />
                <span className="text-slate-500">No FAQPage JSON-LD on the page</span>
              </>
            )}
          </div>
          {report.faqSchema.errors.map((m, i) => (
            <p key={`e${i}`} className="text-red-700 break-words">• {m}</p>
          ))}
          {report.faqSchema.warnings.map((m, i) => (
            <p key={`w${i}`} className="text-amber-700 break-words">• {m}</p>
          ))}
        </div>
      )}

      {!!report.altTexts?.length && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
          <h4 className="text-sm font-bold text-slate-900">Image Alt Text ({report.altTexts.length})</h4>
          {report.altTexts.map((alt, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`px-2 py-0.5 text-[11px] font-bold uppercase rounded-md border ${
                  alt.status === 'MISSING'
                    ? 'bg-acc-rose text-ink border-ink'
                    : alt.duplicate
                    ? 'bg-acc-amber text-ink border-ink'
                    : 'bg-acc-green text-ink border-ink'
                }`}
              >
                {alt.status === 'MISSING' ? 'Missing' : alt.duplicate ? 'Duplicate' : 'Found'}
              </span>
              <span className="text-slate-800 font-medium">{alt.expected}</span>
              <span className="text-slate-500">
                {alt.status === 'MISSING'
                  ? 'not on any <img> in the page source'
                  : alt.duplicate
                  ? `used on ${alt.pageCount} images (doc lists it ${alt.expectedCount})`
                  : `on ${alt.pageCount} image${alt.pageCount > 1 ? 's' : ''}`}
              </span>
            </div>
          ))}
        </div>
      )}


      {!!report.schemas?.length && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
          <h4 className="text-sm font-bold text-slate-900">Schema in Doc ({report.schemas.length})</h4>
          {report.schemas.map((schema, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`px-2 py-0.5 text-[11px] font-bold uppercase rounded-md border ${
                  schema.status === 'MISSING'
                    ? 'bg-acc-rose text-ink border-ink'
                    : schema.status === 'INVALID'
                    ? 'bg-acc-amber text-ink border-ink'
                    : 'bg-acc-green text-ink border-ink'
                }`}
              >
                {schema.status === 'INVALID' ? 'Unreadable' : schema.status === 'MISSING' ? 'Missing' : 'Found'}
              </span>
              <span className="text-slate-800 font-medium">{schema.types.join(', ') || 'Unknown type'}</span>
              <span className="text-slate-500">
                {schema.status === 'MISSING'
                  ? `not in the page JSON-LD: ${schema.missingTypes.join(', ')}`
                  : schema.status === 'INVALID'
                  ? 'could not be read as JSON-LD (broken JSON or no @type), so it was not checked'
                  : 'present in the page JSON-LD'}
              </span>
            </div>
          ))}
        </div>
      )}

      </div>

      {(!!report.links?.length || !!report.extraLinks?.length) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-bold text-slate-900">Links ({report.links?.length ?? 0})</h4>
            {(['MATCH', 'ANCHOR_DIFFERS', 'WRONG_URL', 'NOT_LINKED', 'MISSING'] as const).map((status) => {
              const count = report.links?.filter((l) => l.status === status).length ?? 0;
              return count ? <StatusBadge key={status} tone={LINK_TONE[status]} label={`${count} ${LINK_LABEL[status]}`} /> : null;
            })}
          </div>
          {!report.links?.length && <p className="text-slate-500">The doc has no links in its article content.</p>}
          {report.links?.map((link, i) => (
            <div key={i} className="space-y-1 border-t border-slate-100 pt-2 first-of-type:border-0 first-of-type:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={LINK_TONE[link.status]} label={LINK_LABEL[link.status]} />
                <span className="text-slate-800 font-semibold break-words">"{link.text}"</span>
                <span className="text-slate-400">in {link.context}</span>
              </div>
              <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1">
                <span className="text-slate-500">Doc link</span>
                <span className="text-slate-800 font-medium break-all">{link.expectedUrl}</span>
                <span className="text-slate-500">Live page</span>
                <span className={`font-medium break-all ${link.status === 'MATCH' ? 'text-slate-800' : 'text-rose-700'}`}>
                  {link.status === 'MISSING'
                    ? 'Anchor text not found on the page'
                    : link.status === 'NOT_LINKED'
                    ? 'Text is on the page but not linked'
                    : link.status === 'ANCHOR_DIFFERS'
                    ? `Same URL, anchor text is "${link.actualText}"`
                    : link.actualUrl}
                </span>
              </div>
            </div>
          ))}
          {!!report.extraLinks?.length && (
            <details className="pt-1">
              <summary className="cursor-pointer py-2 text-slate-500 font-semibold">
                {report.extraLinks.length} link{report.extraLinks.length === 1 ? '' : 's'} on the page not in the doc (info only)
              </summary>
              <ul className="mt-2 space-y-1">
                {report.extraLinks.map((link, i) => (
                  <li key={i} className="break-all">
                    <span className="text-slate-800 font-medium">"{link.text}"</span>{' '}
                    <span className="text-slate-500">→ {link.href}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      </div>

      {/* Tabs & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('comparison')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'comparison'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Comparison Results ({report.results.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reference')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'reference'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Reference Structure ({report.referenceTree.elements.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('website')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'website'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Website Structure ({report.websiteTree.elements.length})
          </button>
        </div>

        {activeTab === 'comparison' && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-on-page-soft font-medium mr-1 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Filter:
            </span>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({report.results.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('issues')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                filter === 'issues'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              Issues ({report.summary.wrongTag + report.summary.wrongOrder + report.summary.contentMismatch + report.summary.missing})
            </button>
            <button
              type="button"
              onClick={() => setFilter('pass')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                filter === 'pass'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              Passed ({report.summary.passed})
            </button>
          </div>
        )}
      </div>

      {/* Tab 1: Detailed Comparison Results */}
      {activeTab === 'comparison' && (
        <div className="space-y-3">
          {filteredResults.length === 0 ? (
            <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl text-xs text-slate-500">
              No elements found matching the active filter.
            </div>
          ) : (
            filteredResults.map((item) => {
              const statusStyle =
                item.status === 'PASS'
                  ? {
                      badge: 'bg-acc-green text-ink border-ink',
                      border: 'border-slate-200 hover:border-emerald-300',
                      label: 'PASS',
                    }
                  : item.status === 'WRONG_TAG'
                  ? {
                      badge: 'bg-acc-amber text-ink border-ink',
                      border: 'border-amber-200 bg-amber-50/20',
                      label: 'WRONG TAG',
                    }
                  : item.status === 'WRONG_ORDER'
                  ? {
                      badge: 'bg-acc-amber text-ink border-ink',
                      border: 'border-amber-200 bg-amber-50/20',
                      label: 'WRONG ORDER',
                    }
                  : item.status === 'CONTENT_MISMATCH' && item.minor
                  ? {
                      badge: 'bg-acc-amber text-ink border-ink',
                      border: 'border-amber-200 bg-amber-50/20',
                      label: 'MINOR DIFFERENCE',
                    }
                  : item.status === 'CONTENT_MISMATCH'
                  ? {
                      badge: 'bg-acc-rose text-ink border-ink',
                      border: 'border-rose-200 bg-rose-50/20',
                      label: 'CONTENT MISMATCH',
                    }
                  : {
                      badge: 'bg-acc-rose text-ink border-ink',
                      border: 'border-red-200 bg-red-50/20',
                      label: 'MISSING',
                    };

              return (
                <div
                  key={item.id}
                  className={`bg-white border rounded-2xl p-4 transition-all shadow-2xs space-y-3 ${statusStyle.border}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-400">
                        #{item.order}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[11px] font-bold uppercase rounded-md border ${statusStyle.badge}`}
                      >
                        {statusStyle.label}
                      </span>
                      <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        &lt;{item.reference.tag}&gt;
                      </span>
                      {item.outOfOrder && (
                        <span className="text-xs font-mono font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                          &#8644; out of order
                        </span>
                      )}
                      {item.website && item.website.tag !== item.reference.tag && (
                        <span className="text-xs font-mono font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                          &rarr; &lt;{item.website.tag}&gt; on page
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 font-medium min-w-0 break-words">
                      {item.message}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Reference Element */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Reference (Google Doc)
                      </span>
                      <StructuredElementContent
                        {...item.reference}
                        side="reference"
                        counterpart={item.status === 'CONTENT_MISMATCH' ? item.website : undefined}
                      />
                    </div>

                    {/* Website Element */}
                    <div
                      className={`p-3 border rounded-xl space-y-1 ${
                        item.website
                          ? 'bg-white border-slate-200'
                          : 'bg-rose-50/50 border-rose-200 text-rose-700'
                      }`}
                    >
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Live Website
                      </span>
                      {item.website ? (
                        <StructuredElementContent
                          {...item.website}
                          side="website"
                          counterpart={item.status === 'CONTENT_MISMATCH' ? item.reference : undefined}
                        />
                      ) : (
                        <p className="text-rose-600 font-medium italic">
                          Element was not detected on the live webpage.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Reference Structure Preview */}
      {activeTab === 'reference' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Extracted Reference Structure (Starting from First H1)
            </h4>
            <p className="text-xs text-slate-500">
              The semantic hierarchy extracted from the public Google Doc. All pre-H1 notes and metadata have been ignored.
            </p>
          </div>

          <div className="space-y-2">
            {report.referenceTree.elements.map((el, i) => (
              <div
                key={el.id}
                className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs"
              >
                <span className="text-[11px] font-mono text-slate-400 font-bold shrink-0 mt-0.5">
                  #{i + 1}
                </span>
                <span
                  className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] uppercase shrink-0 ${
                    el.type === 'heading'
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : el.type === 'list'
                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                      : el.type === 'table'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  &lt;{el.tag}&gt;
                </span>
                <StructuredElementContent
                  tag={el.tag}
                  text={el.text}
                  items={el.type === 'list' ? el.items : undefined}
                  rows={el.type === 'table' ? el.rows : undefined}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Website Structure Preview */}
      {activeTab === 'website' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Extracted Website Semantic Tree
            </h4>
            <p className="text-xs text-slate-500">
              The semantic hierarchy extracted from the target website starting from the first H1.
            </p>
          </div>

          <div className="space-y-2">
            {report.websiteTree.elements.map((el, i) => (
              <div
                key={el.id}
                className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs"
              >
                <span className="text-[11px] font-mono text-slate-400 font-bold shrink-0 mt-0.5">
                  #{i + 1}
                </span>
                <span
                  className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] uppercase shrink-0 ${
                    el.type === 'heading'
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : el.type === 'list'
                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                      : el.type === 'table'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  &lt;{el.tag}&gt;
                </span>
                <StructuredElementContent
                  tag={el.tag}
                  text={el.text}
                  items={el.type === 'list' ? el.items : undefined}
                  rows={el.type === 'table' ? el.rows : undefined}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
