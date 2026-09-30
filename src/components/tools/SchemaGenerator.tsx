import React, { useRef, useState } from 'react';
import { Braces, Check, Copy, Eraser } from 'lucide-react';
import { buildFaqSchemaMarkup, copyText } from '../../lib/utils';
import { extractFaqEntriesFromRichText } from '../../lib/faqFromRichText';

export default function SchemaGenerator() {
  const pasteBoxRef = useRef<HTMLDivElement>(null);
  const [pastedHtml, setPastedHtml] = useState('');
  const [isMarkupCopied, setIsMarkupCopied] = useState(false);

  const faqEntries = extractFaqEntriesFromRichText(pastedHtml);
  const faqSchemaMarkup = buildFaqSchemaMarkup(faqEntries);
  const isPasteBoxEmpty = !pasteBoxRef.current?.textContent?.trim();

  const clearPasteBox = () => {
    if (pasteBoxRef.current) pasteBoxRef.current.innerHTML = '';
    setPastedHtml('');
  };

  const copyFaqSchemaMarkup = () => {
    copyText(faqSchemaMarkup).then((wasCopied) => {
      if (!wasCopied) return;
      setIsMarkupCopied(true);
      setTimeout(() => setIsMarkupCopied(false), 2000);
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start text-slate-900">
      {/* Rich Text Paste Box */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-2xs">
              <Braces className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">FAQ Schema Generator</h2>
              <p className="text-xs text-slate-500 font-medium">Paste your FAQ content to generate FAQPage JSON-LD</p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearPasteBox}
            disabled={isPasteBoxEmpty}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-900 border border-slate-200 hover:bg-slate-300 rounded-md text-xs font-medium shadow-xs cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-100"
          >
            <Eraser className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>

        <div className="relative">
          <div
            ref={pasteBoxRef}
            contentEditable
            role="textbox"
            aria-multiline="true"
            aria-label="Pasted FAQ content"
            onInput={(event) => setPastedHtml(event.currentTarget.innerHTML)}
            className="min-h-72 max-h-[60vh] overflow-auto px-4 py-3 text-xs leading-relaxed rounded-lg border border-slate-200 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/50 shadow-xs [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-600 [&_a]:underline [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-bold [&_h4]:font-bold [&_p]:my-1"
          />
          {isPasteBoxEmpty && (
            <p className="absolute inset-x-4 top-3 text-xs text-slate-400 pointer-events-none">
              Paste your FAQs here from Google Docs, Word or a webpage. Each question must be a heading or fully bold text; the content after it becomes its answer.
            </p>
          )}
        </div>
      </div>

      {/* Generated JSON-LD Output */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4 lg:sticky lg:top-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900">JSON-LD Output</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {faqSchemaMarkup ? `${faqEntries.length} question${faqEntries.length === 1 ? '' : 's'} detected` : 'No questions detected yet'}
            </p>
          </div>
          <button
            type="button"
            onClick={copyFaqSchemaMarkup}
            disabled={!faqSchemaMarkup}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-800 rounded-md text-xs font-medium shadow-xs cursor-pointer transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:hover:bg-slate-200"
          >
            {isMarkupCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {isMarkupCopied ? 'Copied' : 'Copy Markup'}
          </button>
        </div>

        <pre className="bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed rounded-lg p-4 overflow-auto max-h-[60vh] whitespace-pre-wrap break-words select-all min-h-32">
          {faqSchemaMarkup || 'Paste FAQ content to generate the markup.'}
        </pre>
      </div>
    </div>
  );
}
