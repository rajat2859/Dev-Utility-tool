import React, { useState } from 'react';
import { ShieldCheck, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Trash2, Plus } from 'lucide-react';
import type { ContentAuditReport } from '../../../server/content-auditor/types/normalized';
import { AuditReportView, runDocAudit } from './GoogleDocAuditView';

const INITIAL_ROWS = 10;
// Each audit fetches a doc and may render the page in a headless browser, so cap how many run at once.
const CONCURRENCY = 3;

interface Row {
  doc: string;
  url: string;
  state: 'idle' | 'running' | 'done' | 'error';
  report?: ContentAuditReport;
  error?: string;
}

const emptyRow = (): Row => ({ doc: '', url: '', state: 'idle' });

// Each row number gets a colour, repeated on its report so you can tell which row you're reading.
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
    <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[11px] font-bold font-mono ${rowColor(i).badge}`}>
      {i + 1}
    </span>
  );
}

const inputClass =
  'w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

export default function BulkDocAuditView() {
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: INITIAL_ROWS }, emptyRow));
  const [isRunning, setIsRunning] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const updateRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  // Pasting cells copied from a spreadsheet (tab-separated "doc<TAB>url" lines) fills rows from here down,
  // adding rows when the paste runs past the end of the table.
  const handlePaste = (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\t') && !text.includes('\n')) return;
    e.preventDefault();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    setRows((prev) => {
      const next = [...prev];
      lines.forEach((line, k) => {
        const [doc = '', url = ''] = line.split('\t').map((c) => c.trim());
        next[i + k] = { ...emptyRow(), doc, url };
      });
      return next;
    });
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

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            One doc/page pair per row. Docs must be shared as <strong className="text-slate-700">Anyone with the link &rarr; Viewer</strong>.
            You can paste two columns straight from a spreadsheet into any cell.
          </p>
          <button
            type="button"
            onClick={() => {
              setRows(Array.from({ length: INITIAL_ROWS }, emptyRow));
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
                <th className="pb-2 pr-2 w-44">Result</th>
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
                      title="Clear row"
                      onClick={() => {
                        updateRow(i, emptyRow());
                        if (selected === i) setSelected(null);
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
        <div className={`space-y-4 border-l-4 pl-4 ${rowColor(selected).border}`}>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex items-start gap-3 text-xs">
            <RowNumber i={selected} />
            <div className="min-w-0 space-y-0.5">
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

  const status = row.report?.summary.status;
  const badge =
    row.state === 'error'
      ? { cls: 'bg-rose-100 text-rose-800 border-rose-200', icon: <XCircle className="h-3.5 w-3.5" />, label: 'Error' }
      : status === 'PASS'
      ? { cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Pass' }
      : status === 'PASS_WITH_WARNINGS'
      ? { cls: 'bg-amber-100 text-amber-800 border-amber-200', icon: <AlertTriangle className="h-3.5 w-3.5" />, label: 'Warnings' }
      : { cls: 'bg-rose-100 text-rose-800 border-rose-200', icon: <XCircle className="h-3.5 w-3.5" />, label: 'Fail' };

  return (
    <button
      type="button"
      onClick={onView}
      title={isSelected ? 'Hide details' : 'Show details'}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold uppercase rounded-md border cursor-pointer hover:opacity-80 ${badge.cls}`}
    >
      {badge.icon}
      {badge.label}
      {row.report && (
        <span className="font-semibold normal-case opacity-80">
          {row.report.summary.passed}/{row.report.summary.total}
        </span>
      )}
    </button>
  );
}
