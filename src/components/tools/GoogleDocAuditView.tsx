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

export default function GoogleDocAuditView() {
  const [docUrl, setDocUrl] = useState<string>('');
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [contentSelector, setContentSelector] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ContentAuditReport | null>(null);

  const [filter, setFilter] = useState<'all' | 'issues' | 'pass'>('all');
  const [activeTab, setActiveTab] = useState<'comparison' | 'reference' | 'website'>('comparison');

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
      const res = await fetch('/api/content-checker/audit-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleDocUrl: docUrl.trim(),
          targetUrl: targetUrl.trim(),
          contentSelector: contentSelector.trim() || undefined,
        }),
      });

      clearInterval(interval);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Content audit failed.');
      }

      setReport(data.report);
    } catch (err: any) {
      clearInterval(interval);
      setError(err.message || 'An unexpected error occurred during the content audit.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredResults = report
    ? report.results.filter((item) => {
        if (filter === 'issues') return item.status !== 'PASS';
        if (filter === 'pass') return item.status === 'PASS';
        return true;
      })
    : [];

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <form
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
            className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
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

      {/* Results View */}
      {report && (
        <div className="space-y-6">
          {/* Summary Banner Card */}
          <div
            className={`border rounded-2xl p-5 shadow-2xs ${
              report.summary.status === 'PASS'
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : report.summary.status === 'PASS_WITH_WARNINGS'
                ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                : 'bg-rose-50/70 border-rose-200 text-rose-950'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {report.summary.status === 'PASS' ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                ) : report.summary.status === 'PASS_WITH_WARNINGS' ? (
                  <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
                ) : (
                  <XCircle className="h-6 w-6 text-rose-600 shrink-0" />
                )}
                <div>
                  <h3 className="text-sm font-bold tracking-tight">
                    {report.summary.status === 'PASS'
                      ? 'AUDIT PASS — Strict Match'
                      : report.summary.status === 'PASS_WITH_WARNINGS'
                      ? 'PASS WITH WARNINGS — Tag Variations'
                      : 'AUDIT FAIL — Differences Detected'}
                  </h3>
                  <p className="text-xs opacity-80 mt-0.5">
                    {report.summary.status === 'PASS'
                      ? 'All reference headings, paragraphs, lists, and tables match the live webpage structure.'
                      : report.summary.status === 'PASS_WITH_WARNINGS'
                      ? 'Content text matches the reference, but semantic HTML tag levels differ (e.g. H2 vs H3).'
                      : 'Mismatched copy or missing elements were identified between the Google Doc and the live site.'}
                  </p>
                </div>
              </div>

              {/* Metric badges */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                <div className="bg-white/80 border border-slate-200/80 rounded-xl px-2.5 py-1.5 shadow-2xs">
                  <span className="block text-[10px] uppercase font-bold text-slate-500">
                    Total
                  </span>
                  <span className="text-sm font-bold text-slate-800">
                    {report.summary.total}
                  </span>
                </div>
                <div className="bg-white/80 border border-emerald-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
                  <span className="block text-[10px] uppercase font-bold text-emerald-700">
                    Passed
                  </span>
                  <span className="text-sm font-bold text-emerald-700">
                    {report.summary.passed}
                  </span>
                </div>
                <div className="bg-white/80 border border-amber-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
                  <span className="block text-[10px] uppercase font-bold text-amber-700">
                    Wrong Tag
                  </span>
                  <span className="text-sm font-bold text-amber-700">
                    {report.summary.wrongTag}
                  </span>
                </div>
                <div className="bg-white/80 border border-rose-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
                  <span className="block text-[10px] uppercase font-bold text-rose-700">
                    Mismatch
                  </span>
                  <span className="text-sm font-bold text-rose-700">
                    {report.summary.contentMismatch}
                  </span>
                </div>
                <div className="bg-white/80 border border-red-200 rounded-xl px-2.5 py-1.5 shadow-2xs col-span-2 sm:col-span-1">
                  <span className="block text-[10px] uppercase font-bold text-red-700">
                    Missing
                  </span>
                  <span className="text-sm font-bold text-red-700">
                    {report.summary.missing}
                  </span>
                </div>
              </div>
            </div>
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
                <span className="text-slate-500 font-medium mr-1 flex items-center gap-1">
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
                  Issues ({report.summary.wrongTag + report.summary.contentMismatch + report.summary.missing})
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
                          badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                          border: 'border-slate-200 hover:border-emerald-300',
                          label: 'PASS',
                        }
                      : item.status === 'WRONG_TAG'
                      ? {
                          badge: 'bg-amber-100 text-amber-800 border-amber-200',
                          border: 'border-amber-200 bg-amber-50/20',
                          label: 'WRONG TAG',
                        }
                      : item.status === 'CONTENT_MISMATCH'
                      ? {
                          badge: 'bg-rose-100 text-rose-800 border-rose-200',
                          border: 'border-rose-200 bg-rose-50/20',
                          label: 'CONTENT MISMATCH',
                        }
                      : {
                          badge: 'bg-red-100 text-red-800 border-red-200',
                          border: 'border-red-200 bg-red-50/20',
                          label: 'MISSING',
                        };

                  return (
                    <div
                      key={item.id}
                      className={`bg-white border rounded-2xl p-4 transition-all shadow-2xs space-y-3 ${statusStyle.border}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
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
                          {item.website && item.website.tag !== item.reference.tag && (
                            <span className="text-xs font-mono font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                              &rarr; &lt;{item.website.tag}&gt; on page
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 font-medium">
                          {item.message}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {/* Reference Element */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Reference (Google Doc)
                          </span>
                          <p className="text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">
                            {item.reference.text}
                          </p>
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
                            <p className="text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">
                              {item.website.text}
                            </p>
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
                    <div className="text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">
                      {el.text}
                    </div>
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
                    <div className="text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">
                      {el.text}
                    </div>
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
