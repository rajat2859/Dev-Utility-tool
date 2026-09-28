import React, { useState, useEffect } from 'react';
import {
  Globe,
  FileText,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  LogOut,
  ChevronDown,
  ChevronRight,
  Filter,
  Layers,
  Heading,
  List as ListIcon,
  Table as TableIcon,
  Info,
} from 'lucide-react';
import type {
  ContentAuditReport,
  ElementComparisonResult,
  NormalizedDocument,
  NormalizedElement,
} from '../../../server/content-auditor/types/normalized';

interface GoogleAuthStatus {
  authenticated: boolean;
  configured: boolean;
  checking: boolean;
}

export default function GoogleDocAuditView() {
  const [authStatus, setAuthStatus] = useState<GoogleAuthStatus>({
    authenticated: false,
    configured: true,
    checking: true,
  });

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

  // Check Google Auth Status on mount
  const checkAuth = async () => {
    try {
      setAuthStatus((prev) => ({ ...prev, checking: true }));
      const res = await fetch('/api/google/auth/status');
      const data = await res.json();
      setAuthStatus({
        authenticated: !!data.authenticated,
        configured: data.configured !== false,
        checking: false,
      });
    } catch {
      setAuthStatus({
        authenticated: false,
        configured: false,
        checking: false,
      });
    }
  };

  useEffect(() => {
    // Check if returning from OAuth callback
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('google_auth') === 'success') {
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
    checkAuth();
  }, []);

  const handleLogin = () => {
    window.location.href = '/api/google/auth/start';
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/google/auth/logout', { method: 'POST' });
      await checkAuth();
    } catch (err) {
      console.error('Failed to logout:', err);
    }
  };

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
      'Reading document structure from Google Docs API...',
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
          docUrl: docUrl.trim(),
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
      {/* Authentication Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl text-white ${
                authStatus.authenticated ? 'bg-emerald-600' : 'bg-blue-600'
              }`}
            >
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Google Docs Integration
                </h3>
                {authStatus.checking ? (
                  <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    Checking status...
                  </span>
                ) : authStatus.authenticated ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="h-3 w-3" />
                    Not connected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {authStatus.authenticated
                  ? 'Access granted to read Google Docs via official Google Docs API.'
                  : 'Sign in to let Content Audit read document structure directly from Google Docs.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!authStatus.checking &&
              (authStatus.authenticated ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLogin}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  Sign in with Google
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleRunAudit}
        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Google Doc URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-blue-600" />
              <span>Google Doc URL</span>
            </label>
            <input
              type="url"
              placeholder="https://docs.google.com/document/d/.../edit"
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            <p className="text-[11px] text-slate-500">
              Audit starts strictly from the first <strong>Heading 1</strong>. Any
              preamble, notes, or instructions before H1 are automatically ignored.
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
              Scanned starting from the first <strong>&lt;h1&gt;</strong> on the webpage.
              Headers, footers, and sidebars are excluded.
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
                Optional CSS selector to confine webpage content extraction to a specific container.
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
            disabled={isLoading || !authStatus.authenticated}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition-colors cursor-pointer ml-auto"
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
            <p className="font-semibold">{error}</p>
            {error.includes('Heading 1') && (
              <p className="text-[11px] text-rose-700">
                Ensure your Google Doc has at least one heading formatted with the built-in
                Google Docs "Heading 1" paragraph style.
              </p>
            )}
            {error.includes('Permission denied') && (
              <p className="text-[11px] text-rose-700">
                Make sure your signed-in Google account has read access to the doc, or set
                sharing to "Anyone with the link can view".
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
                          label: 'MISMATCH',
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
                  This shows the semantic hierarchy extracted from the Google Doc via the API.
                  All non-content metadata before the first H1 has been stripped.
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
                  This shows the semantic hierarchy extracted from the target website starting from the first H1.
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
