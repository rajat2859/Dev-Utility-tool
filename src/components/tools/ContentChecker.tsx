import React, { useState } from 'react';
import { ShieldCheck, FileText, Layers } from 'lucide-react';
import GoogleDocAuditView from './GoogleDocAuditView';
import BulkDocAuditView from './BulkDocAuditView';

const MODES = [
  { id: 'google-doc', label: 'Google Doc Audit', icon: FileText },
  { id: 'bulk', label: 'Bulk Doc Audit', icon: Layers },
] as const;

export default function ContentChecker() {
  const [auditMode, setAuditMode] = useState<(typeof MODES)[number]['id']>('google-doc');

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
              Audit live webpage content, copy accuracy, and heading structures against Google Docs.
            </p>
          </div>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-fit">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setAuditMode(id)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              auditMode === id
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icon className="h-3.5 w-3.5 text-blue-600" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {auditMode === 'google-doc' ? <GoogleDocAuditView /> : <BulkDocAuditView />}
    </div>
  );
}
