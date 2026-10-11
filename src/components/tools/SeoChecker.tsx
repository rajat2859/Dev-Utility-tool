import React, { useMemo, useState } from 'react';
import { Search, Globe, RefreshCw, AlertTriangle, Download, Sparkles } from 'lucide-react';
import type { IssueTab, Priority, SeoAuditResult, SeoIssue, SeoPage } from '../../../server/seo-audit/types';

type TabId = 'issues' | 'internal' | IssueTab;

interface Column {
  header: string;
  get: (page: SeoPage) => string | number;
}

const PRIORITIES: Priority[] = ['High', 'Medium', 'Low', 'Info'];
const PRIORITY_STYLE: Record<Priority, string> = {
  High: 'bg-rose-100 text-rose-800 border-rose-200',
  Medium: 'bg-amber-100 text-amber-800 border-amber-200',
  Low: 'bg-sky-100 text-sky-800 border-sky-200',
  Info: 'bg-slate-100 text-slate-700 border-slate-200',
};

const first = (list: string[]) => list[0] ?? '';
const nth = (list: string[], i: number) => list[i] ?? '';
const types = (page: SeoPage) => page.structuredData.items.map((i) => i.type);

// Columns per tab, named like Screaming Frog's. The Address column is always shown first.
const COLUMNS: Record<Exclude<TabId, 'issues'>, Column[]> = {
  internal: [
    { header: 'Status', get: (p) => p.error ?? 'OK' },
    { header: 'Title 1', get: (p) => first(p.title) },
    { header: 'Title 1 Length', get: (p) => first(p.title).length },
    { header: 'Meta Description 1', get: (p) => first(p.description) },
    { header: 'Meta Description 1 Length', get: (p) => first(p.description).length },
    { header: 'H1-1', get: (p) => first(p.h1) },
    { header: 'Images', get: (p) => p.images.total },
    { header: 'Issues', get: (p) => p.issues.filter((i) => i.priority !== 'Info').length },
  ],
  'Page Titles': [
    { header: 'Title 1', get: (p) => first(p.title) },
    { header: 'Title 1 Length', get: (p) => first(p.title).length },
    { header: 'Title 1 Pixel Width', get: (p) => p.titlePixels },
    { header: 'Title 2', get: (p) => nth(p.title, 1) },
  ],
  'Meta Description': [
    { header: 'Meta Description 1', get: (p) => first(p.description) },
    { header: 'Meta Description 1 Length', get: (p) => first(p.description).length },
    { header: 'Meta Description 1 Pixel Width', get: (p) => p.descriptionPixels },
    { header: 'Meta Description 2', get: (p) => nth(p.description, 1) },
  ],
  H1: [
    { header: 'H1-1', get: (p) => first(p.h1) },
    { header: 'H1-1 Length', get: (p) => first(p.h1).length },
    { header: 'H1-2', get: (p) => nth(p.h1, 1) },
    { header: 'H1 Count', get: (p) => p.h1.length },
  ],
  H2: [
    { header: 'H2-1', get: (p) => first(p.h2) },
    { header: 'H2-1 Length', get: (p) => first(p.h2).length },
    { header: 'H2-2', get: (p) => nth(p.h2, 1) },
    { header: 'H2 Count', get: (p) => p.h2.length },
  ],
  Images: [
    { header: 'Images', get: (p) => p.images.total },
    { header: 'Missing Alt Text', get: (p) => p.images.missingAltText.length },
    { header: 'Missing Alt Attribute', get: (p) => p.images.missingAltAttribute.length },
    { header: 'Alt Text Over 100 Characters', get: (p) => p.images.altOver100.length },
  ],
  Canonicals: [
    { header: 'Canonical Link Element 1', get: (p) => first(p.canonical) },
    { header: 'Canonical Link Element 2', get: (p) => nth(p.canonical, 1) },
  ],
  Directives: [{ header: 'Meta Robots', get: (p) => p.robots.join(', ') }],
  'Structured Data': [
    { header: 'Errors', get: (p) => p.structuredData.errors },
    { header: 'Warnings', get: (p) => p.structuredData.warnings },
    { header: 'Total Types', get: (p) => types(p).length },
    { header: 'Unique Types', get: (p) => new Set(types(p)).size },
    { header: 'Types', get: (p) => [...new Set(types(p))].join(', ') },
    { header: 'Rich Result Features', get: (p) => [...new Set(p.structuredData.items.map((i) => i.richResult).filter(Boolean))].join(', ') },
  ],
};

const TAB_ORDER: TabId[] = ['issues', 'internal', 'Page Titles', 'Meta Description', 'H1', 'H2', 'Images', 'Canonicals', 'Directives', 'Structured Data'];
const TAB_LABEL = (tab: TabId) => (tab === 'issues' ? 'Issues' : tab === 'internal' ? 'Internal' : tab);

const isLink = (address: string) => /^https?:\/\//i.test(address);

// Cells come from audited pages, so neutralise spreadsheet formulas before export.
const csvCell = (value: string | number) => {
  const text = String(value);
  return `"${(/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
};

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const blob = new Blob([rows.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border shrink-0 ${PRIORITY_STYLE[priority]}`}>{priority}</span>
  );
}

export default function SeoChecker() {
  const [urlsText, setUrlsText] = useState('');
  const [rawHtml, setRawHtml] = useState('');
  const [showHtmlPaste, setShowHtmlPaste] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SeoAuditResult | null>(null);

  const [tab, setTab] = useState<TabId>('issues');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);

  const runAudit = async () => {
    const urls = urlsText.split(/[\s,]+/).filter(Boolean);
    if (!urls.length && !rawHtml.trim()) {
      setError('Enter at least one URL or sitemap URL, or paste raw HTML.');
      return;
    }
    setIsAuditing(true);
    setError(null);
    setResult(null);
    setSelected(null);
    try {
      const res = await fetch('/api/seo-checker/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, rawHtml: rawHtml.trim() || undefined }),
      });
      const data = (res.headers.get('content-type') || '').includes('application/json') ? await res.json() : null;
      if (!res.ok || !data?.success) throw new Error(data?.error || `Audit failed (HTTP ${res.status}).`);
      setResult(data);
      setTab('issues');
      setFilter('all');
    } catch (err: any) {
      setError(err.message || 'The audit failed.');
    } finally {
      setIsAuditing(false);
    }
  };

  const pages = result?.pages ?? [];
  const audited = useMemo(() => pages.filter((p) => !p.error), [pages]);

  // Issues grouped like Frog's Issues pane: one row per (tab, issue) with the number of affected URLs
  const issueGroups = useMemo(() => {
    const groups = new Map<string, { tab: IssueTab; name: string; priority: Priority; urls: number }>();
    for (const page of audited) {
      for (const issue of page.issues) {
        const key = `${issue.tab}|${issue.name}`;
        const group = groups.get(key) ?? { tab: issue.tab, name: issue.name, priority: issue.priority, urls: 0 };
        group.urls++;
        groups.set(key, group);
      }
    }
    return [...groups.values()].sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) || b.urls - a.urls);
  }, [audited]);

  const priorityTotals = PRIORITIES.map((p) => ({ priority: p, count: issueGroups.filter((g) => g.priority === p).reduce((n, g) => n + g.urls, 0) }));

  const tabIssueCount = (t: TabId) =>
    t === 'issues' || t === 'internal' ? 0 : audited.filter((p) => p.issues.some((i) => i.tab === t && i.priority !== 'Info')).length;

  const filters = useMemo(() => issueGroups.filter((g) => g.tab === tab), [issueGroups, tab]);

  const tableHeaders = tab === 'issues' ? [] : ['Address', ...COLUMNS[tab].map((c) => c.header)];
  const tablePages = useMemo(() => {
    if (tab === 'issues') return [];
    const base = tab === 'internal' ? pages : audited;
    return filter === 'all' ? base : base.filter((p) => p.issues.some((i) => i.tab === tab && i.name === filter));
  }, [tab, filter, pages, audited]);

  const selectedPage = pages.find((p) => p.address === selected) ?? null;

  const exportCsv = () => {
    if (tab === 'issues') {
      downloadCsv('seo-audit-issues.csv', [
        ['Address', 'Tab', 'Issue', 'Priority', 'Detail'],
        ...audited.flatMap((p) => p.issues.map((i) => [p.address, i.tab, i.name, i.priority, i.detail ?? ''])),
      ]);
    } else {
      downloadCsv(`seo-audit-${tab.toLowerCase().replace(/\s+/g, '-')}.csv`, [
        tableHeaders,
        ...tablePages.map((p) => [p.address, ...COLUMNS[tab].map((c) => c.get(p))]),
      ]);
    }
  };

  const openIssue = (issueTab: IssueTab, name: string) => {
    setTab(issueTab);
    setFilter(name);
  };

  return (
    <div className="space-y-6 text-slate-900">
      {/* Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-600 rounded-xl text-white shadow-xs">
            <Search className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">SEO & Schema</h2>
            <p className="text-xs text-slate-500">
              Screaming Frog-style audit: page titles, meta descriptions, headings, images, canonicals, directives and structured data validation, for one URL, a URL list or a sitemap.
            </p>
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-blue-600" />
              <span>URLs to audit</span>
            </label>
            <button
              type="button"
              onClick={() => setShowHtmlPaste(!showHtmlPaste)}
              className="text-[11px] text-blue-600 hover:underline font-semibold cursor-pointer"
            >
              {showHtmlPaste ? 'Hide pasted HTML' : 'Add pasted HTML'}
            </button>
          </div>
          <textarea
            rows={4}
            placeholder={'One URL per line, or a sitemap.xml URL (up to 100 pages)\nhttps://example.com/\nhttps://example.com/services'}
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            className="w-full p-3 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white shadow-2xs"
          />
          {showHtmlPaste && (
            <textarea
              rows={4}
              placeholder="Paste complete HTML source (for sites that block automated requests). It is audited as an extra row."
              value={rawHtml}
              onChange={(e) => setRawHtml(e.target.value)}
              className="w-full p-3 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white shadow-2xs"
            />
          )}
        </div>

        <button
          type="button"
          onClick={runAudit}
          disabled={isAuditing || (!urlsText.trim() && !rawHtml.trim())}
          className="w-full py-3 px-4 rounded-xl font-bold text-xs tracking-tight flex items-center justify-center gap-2 transition-all shadow-2xs bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
        >
          {isAuditing ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin text-white" />
              <span>Auditing pages...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>Run SEO & Schema Audit</span>
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

      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
            <div className="bg-white border border-slate-200 rounded-xl px-2.5 py-2 shadow-2xs">
              <span className="block text-[10px] uppercase font-bold text-slate-500">Pages</span>
              <span className="text-sm font-bold text-slate-800">
                {audited.length}
                {pages.length > audited.length && <span className="text-rose-600"> +{pages.length - audited.length} failed</span>}
              </span>
            </div>
            {priorityTotals.map(({ priority, count }) => (
              <div key={priority} className={`border rounded-xl px-2.5 py-2 shadow-2xs ${PRIORITY_STYLE[priority]}`}>
                <span className="block text-[10px] uppercase font-bold">{priority}</span>
                <span className="text-sm font-bold">{count}</span>
              </div>
            ))}
            <button
              type="button"
              onClick={exportCsv}
              className="bg-white border border-slate-200 hover:bg-slate-50 rounded-xl px-2.5 py-2 shadow-2xs flex items-center justify-center gap-1.5 font-semibold text-slate-700 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
          {result.notices.map((notice) => (
            <p key={notice} className="text-xs text-slate-500">
              {notice}
            </p>
          ))}

          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto bg-slate-100 p-1 rounded-xl border border-slate-200">
            {TAB_ORDER.map((t) => {
              const count = tabIssueCount(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTab(t);
                    setFilter('all');
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    tab === t ? 'bg-white text-blue-700 shadow-2xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{TAB_LABEL(t)}</span>
                  {count > 0 && <span className="px-1.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">{count}</span>}
                </button>
              );
            })}
          </div>

          {/* Issues overview */}
          {tab === 'issues' && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-x-auto">
              {issueGroups.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-500">No issues found on the audited pages.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Issue</th>
                      <th className="px-3 py-2">Tab</th>
                      <th className="px-3 py-2">Priority</th>
                      <th className="px-3 py-2 text-right">URLs</th>
                      <th className="px-3 py-2 text-right">% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issueGroups.map((g) => (
                      <tr
                        key={`${g.tab}|${g.name}`}
                        onClick={() => openIssue(g.tab, g.name)}
                        className="border-t border-slate-100 hover:bg-blue-50/50 cursor-pointer"
                      >
                        <td className="px-3 py-2 font-medium text-slate-800">{g.name}</td>
                        <td className="px-3 py-2 text-slate-600">{g.tab}</td>
                        <td className="px-3 py-2">
                          <PriorityBadge priority={g.priority} />
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{g.urls}</td>
                        <td className="px-3 py-2 text-right font-mono">{Math.round((g.urls / audited.length) * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Data table with Frog-style filter */}
          {tab !== 'issues' && (
            <div className="space-y-2">
              {tab !== 'internal' && (
                <div className="flex items-center gap-2 text-xs">
                  <label className="font-semibold text-slate-600">Filter:</label>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800"
                  >
                    <option value="all">All ({audited.length})</option>
                    {filters.map((g) => (
                      <option key={g.name} value={g.name}>
                        {g.name} ({g.urls})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-auto max-h-[28rem]">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500 sticky top-0">
                    <tr>
                      {tableHeaders.map((h) => (
                        <th key={h} className="px-3 py-2 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tablePages.map((page) => (
                      <tr
                        key={page.address}
                        onClick={() => setSelected(page.address)}
                        className={`border-t border-slate-100 cursor-pointer ${
                          selected === page.address ? 'bg-blue-50' : 'hover:bg-slate-50'
                        } ${page.error ? 'text-rose-700' : ''}`}
                      >
                        <td className="px-3 py-2 max-w-[20rem] truncate font-medium" title={page.address}>
                          {page.address}
                        </td>
                        {COLUMNS[tab].map((c) => {
                          const value = c.get(page);
                          return (
                            <td key={c.header} className="px-3 py-2 max-w-[22rem] truncate" title={String(value)}>
                              {value}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {tablePages.length === 0 && (
                      <tr>
                        <td colSpan={tableHeaders.length} className="px-3 py-6 text-center text-slate-500">
                          No pages match this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Selected page details */}
          {selectedPage && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Selected URL</span>
                {isLink(selectedPage.address) ? (
                  <a href={selectedPage.address} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:underline break-all font-semibold">
                    {selectedPage.address}
                  </a>
                ) : (
                  <p className="font-semibold">{selectedPage.address}</p>
                )}
                {selectedPage.error && <p className="text-rose-700 mt-1">{selectedPage.error}</p>}
              </div>

              {selectedPage.issues.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-900">Issues ({selectedPage.issues.length})</h4>
                  {(selectedPage.issues as SeoIssue[]).map((issue, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={issue.priority} />
                      <span className="text-slate-500">{issue.tab}</span>
                      <span className="font-semibold text-slate-800">{issue.name}</span>
                      {issue.detail && <span className="text-slate-500 break-all">{issue.detail}</span>}
                    </div>
                  ))}
                </div>
              )}

              {selectedPage.structuredData.items.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900">Structured Data ({selectedPage.structuredData.items.length})</h4>
                  {selectedPage.structuredData.items.map((item, i) => (
                    <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-800">{item.type}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">{item.format}</span>
                        {item.richResult && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold">Rich result: {item.richResult}</span>
                        )}
                        {!item.errors.length && !item.warnings.length && <span className="text-emerald-700 font-semibold">Valid</span>}
                      </div>
                      {item.errors.map((m) => (
                        <p key={m} className="text-rose-700">
                          Error: {m}
                        </p>
                      ))}
                      {item.warnings.map((m) => (
                        <p key={m} className="text-amber-700">
                          Warning: {m}
                        </p>
                      ))}
                      {item.json !== undefined && (
                        <details>
                          <summary className="cursor-pointer text-blue-600 font-semibold">View JSON-LD</summary>
                          <pre className="mt-1 p-2 bg-slate-50 rounded-lg overflow-x-auto text-[11px]">{JSON.stringify(item.json, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
