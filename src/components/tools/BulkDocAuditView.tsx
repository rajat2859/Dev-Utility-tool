import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ContentAuditReport } from '../../../server/content-auditor/types/normalized';
import { AuditReportView, runDocAudit } from './GoogleDocAuditView';
import { pairDocAndPageLinks } from '../../lib/utils';

// Excel and Google Sheets put an HTML table on the clipboard; hyperlinked cells only
// keep their real URL there (the plain text has just the display text)
function cellsFromHtml(html: string): string[][] {
  const table = new DOMParser().parseFromString(html, 'text/html');
  return [...table.querySelectorAll('tr')].map((tr) =>
    [...tr.querySelectorAll('td, th')].map((cell) => {
      const href = [...cell.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? '').find((h) => /^https?:/i.test(h));
      return href ?? cell.textContent ?? '';
    })
  );
}

const INITIAL_ROWS = 1;
const CONCURRENCY = 3;

interface Row {
  doc: string;
  url: string;
  state: 'idle' | 'running' | 'done' | 'error';
  report?: ContentAuditReport;
  error?: string;
}

const emptyRow = (): Row => ({ doc: '', url: '', state: 'idle' });

const ROW_COLORS = [
  { badge: 'bg-blue-600 text-white', border: 'border-l-blue-600' },
  { badge: 'bg-violet-600 text-white', border: 'border-l-violet-600' },
  { badge: 'bg-teal-600 text-white', border: 'border-l-teal-600' },
  { badge: 'bg-orange-500 text-white', border: 'border-l-orange-500' },
  { badge: 'bg-pink-600 text-white', border: 'border-l-pink-600' },
];
const rowColor = (i: number) => ROW_COLORS[i % ROW_COLORS.length];

function RowNumber({ i }: { i: number }) {
  return (
    <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 text-[11px] font-bold font-mono ${rowColor(i).badge}`}>
      {i + 1}
    </span>
  );
}

type Outcome = 'pass' | 'warn' | 'fail' | 'error';

function outcomeOf(row: Row): Outcome | null {
  if (row.state === 'error') return 'error';
  if (row.state !== 'done' || !row.report) return null;
  const status = row.report.summary.status;
  return status === 'PASS' ? 'pass' : status === 'PASS_WITH_WARNINGS' ? 'warn' : 'fail';
}

// POP accent tokens: the theme leaves bg-acc-* alone, so the colors survive
const OUTCOME_BADGE: Record<Outcome, { cls: string; icon: React.ReactNode; label: string }> = {
  pass: { cls: 'bg-acc-green text-ink', icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Pass' },
  warn: { cls: 'bg-acc-amber text-ink', icon: <AlertTriangle className="h-3.5 w-3.5" />, label: 'Warnings' },
  fail: { cls: 'bg-acc-rose text-ink', icon: <XCircle className="h-3.5 w-3.5" />, label: 'Fail' },
  error: { cls: 'bg-acc-rose text-ink', icon: <XCircle className="h-3.5 w-3.5" />, label: 'Error' },
};

// One-line "what went wrong" for the results column, e.g. "2 mismatch · 1 missing · meta"
function issueSummary(report: ContentAuditReport): string {
  const s = report.summary;
  const parts: string[] = [];
  if (s.contentMismatch) parts.push(`${s.contentMismatch} mismatch`);
  if (s.missing) parts.push(`${s.missing} missing`);
  if (s.wrongTag) parts.push(`${s.wrongTag} wrong tag`);
  if (s.wrongOrder) parts.push(`${s.wrongOrder} wrong order`);
  if (report.urlCheck?.status === 'MISMATCH') parts.push('URL');
  if (report.metaChecks?.some((m) => m.status === 'MISMATCH' || m.status === 'MISSING_ON_PAGE')) parts.push('meta');
  if (report.altTexts?.some((a) => a.status === 'MISSING')) parts.push('alt text');
  if (report.schemas?.some((x) => x.status === 'MISSING')) parts.push('schema');
  if (report.faqSchema?.errors.length) parts.push('FAQ schema');
  return parts.join(' · ');
}

const inputClass =
  'w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

export default function BulkDocAuditView() {
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: INITIAL_ROWS }, emptyRow));
  const [isRunning, setIsRunning] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const updateRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const [pasteNote, setPasteNote] = useState<string | null>(null);

  const handlePaste = (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    const html = e.clipboardData.getData('text/html');
    const fromSheet = /<tr[\s>]/i.test(html);
    // A single plain value is ordinary typing-style paste into this cell
    if (!fromSheet && !text.includes('\t') && !text.includes('\n')) return;

    const { pairs, skipped } = pairDocAndPageLinks(fromSheet ? cellsFromHtml(html) : text.split(/\r?\n/).map((l) => l.split('\t')));
    if (!pairs.length) return;
    e.preventDefault();

    setRows((prev) => {
      const next = [...prev];
      pairs.forEach(({ doc, url }, k) => {
        const current = next[i + k] ?? emptyRow();
        // A row with only one link keeps whatever the other column already had
        next[i + k] = { ...emptyRow(), doc: doc || current.doc, url: url || current.url };
      });
      return next;
    });
    setSelected(null);
    const n = pairs.length;
    const plural = n === 1 ? '' : 's';
    const incomplete = pairs.filter((p) => !p.doc || !p.url).length;
    const what = pairs.every((p) => !p.url)
      ? `Pasted ${n} doc link${plural}`
      : pairs.every((p) => !p.doc)
      ? `Pasted ${n} page URL${plural}`
      : `Pasted ${n} row${plural}`;
    setPasteNote(
      [
        what,
        skipped && `skipped ${skipped} line${skipped === 1 ? '' : 's'} with no link (like a header row)`,
        // Only worth flagging when the paste was meant to carry both columns
        incomplete && incomplete < n && `${incomplete} row${incomplete === 1 ? '' : 's'} had only one link`,
      ].filter(Boolean).join(' · ') + '.'
    );
  };

  const handleRun = async () => {
    const todo = rows.map((r, i) => i).filter((i) => rows[i].doc.trim() && rows[i].url.trim());
    if (!todo.length) return;
    setIsRunning(true);
    setSelected(null);
    todo.forEach((i) => updateRow(i, { state: 'running', report: undefined, error: undefined }));

    const queue = [...todo];
    const worker = async () => {
      for (let i = queue.shift(); i !== undefined; i = queue.shift()) {
        try {
          const report = await runDocAudit(rows[i].doc, rows[i].url);
          updateRow(i, { state: 'done', report });
        } catch (err: any) {
          updateRow(i, { state: 'error', error: err.message || 'Content audit failed.' });
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setIsRunning(false);
  };

  const filledCount = rows.filter((r) => r.doc.trim() && r.url.trim()).length;
  const selectedReport = selected !== null ? rows[selected].report : undefined;

  const outcomes = rows.map(outcomeOf);
  const finished = outcomes.flatMap((o, i) => (o ? [i] : []));
  const counts = { pass: 0, warn: 0, fail: 0, error: 0 };
  outcomes.forEach((o) => o && counts[o]++);
  const firstIssue = finished.find((i) => outcomes[i] !== 'pass');
  const pos = selected !== null ? finished.indexOf(selected) : -1;

  const detailsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected !== null) detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selected]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <p className="text-[11px] text-slate-500">
              One doc/page pair per row. Docs must be shared as <strong className="text-slate-700">Anyone with the link &rarr; Viewer</strong>.
            </p>
            <p className="text-[11px] text-slate-500">
              <strong className="text-slate-700">Paste a list:</strong> paste several doc links (or page URLs) into a cell and each one gets its own row.
              You can also paste whole rows from Excel or Google Sheets: columns can be in any order, extra columns and header rows are ignored, and hyperlinked cells use their link.
            </p>
            {pasteNote && (
              <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {pasteNote}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setRows(Array.from({ length: INITIAL_ROWS }, emptyRow));
              setPasteNote(null);
              setSelected(null);
            }}
            disabled={isRunning}
            className="inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear All</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase font-bold text-slate-500">
                <th className="pb-2 pr-2 w-6">#</th>
                <th className="pb-2 pr-2">Google Doc URL</th>
                <th className="pb-2 pr-2">Website URL</th>
                <th className="pb-2 pr-2 w-72">Result</th>
                <th className="pb-2 w-6" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={selected === i ? 'bg-blue-100/70' : i % 2 ? 'bg-slate-50' : undefined}>
                  <td className="py-1 px-1.5"><RowNumber i={i} /></td>
                  <td className="py-1 pr-2">
                    <input
                      type="url"
                      placeholder="https://docs.google.com/document/d/.../edit"
                      value={row.doc}
                      onChange={(e) => updateRow(i, { doc: e.target.value })}
                      onPaste={(e) => handlePaste(i, e)}
                      disabled={isRunning}
                      className={inputClass}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      type="url"
                      placeholder="https://example.com/page"
                      value={row.url}
                      onChange={(e) => updateRow(i, { url: e.target.value })}
                      onPaste={(e) => handlePaste(i, e)}
                      disabled={isRunning}
                      className={inputClass}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <RowResult row={row} onView={() => setSelected(selected === i ? null : i)} isSelected={selected === i} />
                  </td>
                  <td className="py-1">
                    <button
                      type="button"
                      title={rows.length > 1 ? 'Remove row' : 'Clear row'}
                      onClick={() => {
                        // Rows grow with what you paste, so the bin removes the row; the last one is just cleared
                        setRows((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : [emptyRow()]));
                        if (selected === i) setSelected(null);
                        else if (selected !== null && selected > i) setSelected(selected - 1);
                      }}
                      disabled={isRunning}
                      className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {finished.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 text-xs">
            <span className="font-semibold text-slate-600">{finished.length} checked:</span>
            {(Object.keys(counts) as Outcome[]).filter((o) => counts[o]).map((o) => (
              <span key={o} className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold uppercase rounded-md border border-ink ${OUTCOME_BADGE[o].cls}`}>
                {OUTCOME_BADGE[o].icon}
                {counts[o]} {OUTCOME_BADGE[o].label}
              </span>
            ))}
            {firstIssue !== undefined && (
              <button
                type="button"
                onClick={() => setSelected(firstIssue)}
                className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Review issues
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, emptyRow()])}
            disabled={isRunning}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Row</span>
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={isRunning || !filledCount}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            <span>{isRunning ? 'Auditing…' : `Run ${filledCount || ''} Audit${filledCount === 1 ? '' : 's'}`}</span>
          </button>
        </div>
      </div>

      {selected !== null && (rows[selected].state === 'error' || selectedReport) && (
        <div ref={detailsRef} className={`space-y-4 border-l-4 pl-4 scroll-mt-4 ${rowColor(selected).border}`}>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex items-start gap-3 text-xs">
            <RowNumber i={selected} />
            <div className="min-w-0 flex-1 space-y-0.5">
              <h4 className="text-sm font-bold text-slate-900">Row {selected + 1} results</h4>
              <p className="text-slate-500 break-all">
                <span className="font-semibold text-slate-600">Doc:</span>{' '}
                <a href={rows[selected].doc} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{rows[selected].doc}</a>
              </p>
              <p className="text-slate-500 break-all">
                <span className="font-semibold text-slate-600">Page:</span>{' '}
                <a href={rows[selected].url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{rows[selected].url}</a>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500">{pos + 1} / {finished.length}</span>
              <button
                type="button"
                title="Previous result"
                onClick={() => setSelected(finished[pos - 1])}
                disabled={pos <= 0}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Next result"
                onClick={() => setSelected(finished[pos + 1])}
                disabled={pos < 0 || pos >= finished.length - 1}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          {rows[selected].state === 'error' && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="font-semibold whitespace-pre-wrap">{rows[selected].error}</p>
            </div>
          )}
          {selectedReport && <AuditReportView key={selected} report={selectedReport} />}
        </div>
      )}
    </div>
  );
}

function RowResult({ row, onView, isSelected }: { row: Row; onView: () => void; isSelected: boolean }) {
  if (row.state === 'idle') return <span className="text-slate-300">—</span>;
  if (row.state === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 text-blue-700">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Running
      </span>
    );
  }

  const badge = OUTCOME_BADGE[outcomeOf(row) ?? 'error'];
  const issues = row.state === 'error' ? row.error : row.report && issueSummary(row.report);

  return (
    <button
      type="button"
      onClick={onView}
      title={isSelected ? 'Hide details' : 'Show details'}
      className="flex w-full min-w-0 items-center gap-2 text-left cursor-pointer group"
    >
      <span className={`inline-flex shrink-0 items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold uppercase rounded-md border border-ink group-hover:opacity-80 ${badge.cls}`}>
        {badge.icon}
        {badge.label}
        {row.report && (
          <span className="font-semibold normal-case opacity-80">
            {row.report.summary.passed}/{row.report.summary.total}
          </span>
        )}
      </span>
      {issues && <span className="truncate text-[11px] text-slate-600 group-hover:underline" title={issues}>{issues}</span>}
    </button>
  );
}
