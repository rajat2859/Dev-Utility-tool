import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Code,
  FileCode,
  Copy,
  Check,
  Download,
  Trash2,
  Sparkles,
  Eye,
  SlidersHorizontal,
  FileText,
  CheckCircle2,
  Info,
  Upload,
  Replace,
  FileSpreadsheet,
  Zap,
  Globe,
  ShieldAlert,
  ListFilter,
  Image as ImageIcon,
  Link2,
  Table as TableIcon,
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Eraser,
  Layers,
  Wrench,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface CleanOptions {
  stripTagAttributes: boolean;
  stripInlineStyles: boolean;
  stripClassesAndIds: boolean;
  removeAllTags: boolean;
  removeSuccessiveNbsp: boolean;
  removeEmptyTags: boolean;
  removeTagsWithOneNbsp: boolean;
  removeSpanTags: boolean;
  removeDivTags: boolean;
  removeImages: boolean;
  removeLinks: boolean;
  removeTables: boolean;
  replaceTablesWithDivs: boolean;
  removeComments: boolean;
  removeAriaAttributes: boolean;
  setNewLinesAndIndents: boolean;

  stripScripts: boolean;
  stripStyles: boolean;
  convertSemanticTags: boolean;
  fixSmartQuotes: boolean;
  formatting: 'pretty' | 'minify' | 'raw';
  tagWhitelistMode: boolean;
  allowedTags: string;
}

const DEFAULT_OPTIONS: CleanOptions = {
  stripTagAttributes: true,
  stripInlineStyles: true,
  stripClassesAndIds: true,
  removeAllTags: false,
  removeSuccessiveNbsp: true,
  removeEmptyTags: false,
  removeTagsWithOneNbsp: true,
  removeSpanTags: true,
  removeDivTags: true,
  removeImages: false,
  removeLinks: false,
  removeTables: false,
  replaceTablesWithDivs: false,
  removeComments: true,
  removeAriaAttributes: true,
  setNewLinesAndIndents: false,

  stripScripts: true,
  stripStyles: true,
  convertSemanticTags: true,
  fixSmartQuotes: true,
  formatting: 'pretty',
  tagWhitelistMode: false,
  allowedTags: 'p, h1, h2, h3, h4, h5, h6, ul, ol, li, strong, em, a, img, blockquote, code, pre, table, tr, td, th, tbody, thead',
};

const MAIN_CLEANING_OPTIONS = [
  { key: 'stripTagAttributes', label: 'Remove tag attributes', icon: Wrench },
  { key: 'stripInlineStyles', label: 'Remove inline styles', icon: Eraser },
  { key: 'stripClassesAndIds', label: 'Remove classes and IDs', icon: Layers },
  { key: 'removeAllTags', label: 'Remove all tags', icon: Trash2 },
  { key: 'removeSuccessiveNbsp', label: 'Remove successive &nbsp;s', icon: Zap },
  { key: 'removeEmptyTags', label: 'Remove empty tags', icon: CheckCircle2 },
  { key: 'removeTagsWithOneNbsp', label: 'Remove tags with one &nbsp;', icon: FileText },
  { key: 'removeSpanTags', label: 'Remove span tags', icon: Layers },
  { key: 'removeDivTags', label: 'Remove div tags', icon: Code },
  { key: 'removeImages', label: 'Remove images', icon: ImageIcon },
  { key: 'removeLinks', label: 'Remove links', icon: Link2 },
  { key: 'removeTables', label: 'Remove tables', icon: TableIcon },
  { key: 'replaceTablesWithDivs', label: 'Replace table tags with <div>s', icon: Code },
  { key: 'removeComments', label: 'Remove comments', icon: Info },
  { key: 'removeAriaAttributes', label: 'Remove ARIA attributes (e.g. aria-level)', icon: ShieldAlert },
  { key: 'setNewLinesAndIndents', label: 'Set new lines and text indents', icon: ListFilter },
] as const;

const SAMPLE_HTML_WORD_DOC = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
  <head>
    <!--[if gte mso 9]><xml><w:WordDocument><w:View>Normal</w:View></w:WordDocument></xml><![endif]-->
    <style>
      p.MsoNormal { margin: 0in; font-size: 12pt; font-family: "Calibri",sans-serif; }
      span.GramE { mso-gram-e: yes; }
    </style>
  </head>
  <body>
    <!-- Main content container exported from Microsoft Word -->
    <div class="MsoNormal" style="mso-margin-top-alt:auto;mso-margin-bottom-alt:auto;line-height:normal;background:white">
      <p class="MsoNormal" style="margin-bottom:0in;line-height:150%">
        <b><span style="font-size:18.0pt;line-height:150%;font-family:'Arial',sans-serif;color:#333333">
          Welcome to the HTML Cleaner & Sanitizer Studio!
        </span></b>
      </p>
      <p class="MsoNormal" style="margin-bottom:10.0pt;line-height:115%">
        <span style="font-size:11.0pt;line-height:115%;font-family:'Calibri',sans-serif">
          This is an example of dirty HTML exported from <i>Microsoft Word</i> or scraped web pages.
          It contains redundant <span class="GramE" style="color:red;">inline styles</span>, mso tags, and tracking scripts.
        </span>
      </p>
      <p class="MsoNormal"></p>
      <script type="text/javascript">
        console.log("Tracking script should be stripped automatically!");
      </script>
      <table border="1" style="width:100%; border-collapse:collapse;">
        <tr>
          <td style="padding:8px; background-color:#f0f0f0;"><b>Feature</b></td>
          <td style="padding:8px; background-color:#f0f0f0;"><b>Status</b></td>
        </tr>
        <tr>
          <td>Word Clean</td>
          <td><span style="color:green;">Active</span></td>
        </tr>
      </table>
      <ul type="disc">
        <li class="MsoNormal" style="color:#222222;mso-margin-top-alt:auto">
          <b>Item 1:</b> Clean typography and “smart quotes” normalization.
        </li>
        <li class="MsoNormal" style="color:#222222;mso-margin-top-alt:auto">
          <b>Item 2:</b> Remove empty tags &lt;p&gt;&lt;/p&gt; and convert old <b>b</b>/<i>i</i> tags to semantic HTML5.
        </li>
      </ul>
      <p class="MsoNormal" style="margin-bottom:0in">
        <a href="https://example.com" onclick="alert('XSS Tracker')" style="color:blue;text-decoration:underline">
          Visit Example Clean Link
        </a>
      </p>
    </div>
  </body>
</html>`;

const SAMPLE_HTML_SCRAPED = `<div id="article-body-9912" class="post-content entry-content grid-container" data-post-id="9912" data-analytics="pageview">
  <!-- Article Header -->
  <h1 class="entry-title hero-heading" style="color: #111827; font-size: 2rem; margin-top: 0;">
    <i>Essential</i> Web Developer Utilities
  </h1>
  <div class="author-box" style="padding: 10px; background: #f3f4f6; border-radius: 4px;">
    <span class="byline" data-author-id="42">By Developer Team</span> | <span class="date">Updated 2026</span>
  </div>
  <iframe src="https://ads.example.com/banner" width="300" height="250" style="border:none;"></iframe>
  <p style="font-family: sans-serif; line-height: 1.6;">
    Building modern web applications requires high-precision tools. Our HTML Cleaner normalizes raw code, 
    strips tracking scripts, and converts <b>old tags</b> into <strong>semantic HTML5</strong>.
  </p>
  <style>
    .post-content { color: #333; }
    .author-box { font-size: 14px; }
  </style>
  <p></p>
  <div class="ad-container" data-ad-slot="12345">
    <!-- Ad banner code -->
  </div>
</div>`;

export default function HtmlCleaner() {
  const [inputHtml, setInputHtml] = useState<string>(SAMPLE_HTML_WORD_DOC);
  const [options, setOptions] = useState<CleanOptions>(DEFAULT_OPTIONS);
  const [copied, setCopied] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [findText, setFindText] = useState<string>('');
  const [replaceText, setReplaceText] = useState<string>('');
  const [showReplaceBar, setShowReplaceBar] = useState<boolean>(false);
  const [rightCodeHtml, setRightCodeHtml] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const wysiwygRef = useRef<HTMLDivElement>(null);
  const rightTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync WYSIWYG editor content when inputHtml changes
  useEffect(() => {
    if (wysiwygRef.current && document.activeElement !== wysiwygRef.current) {
      wysiwygRef.current.innerHTML = inputHtml;
    }
  }, [inputHtml]);

  // Clean HTML according to exact options
  const cleanedResult = useMemo(() => {
    if (!inputHtml.trim()) {
      return {
        html: '',
        markdown: '',
        text: '',
        stats: { inputBytes: 0, outputBytes: 0, tagsRemoved: 0, attrsRemoved: 0, reductionPct: 0, wordCount: 0 }
      };
    }

    let processedHtml = inputHtml;

    // Find and Replace
    if (findText) {
      try {
        const regex = new RegExp(findText, 'gi');
        processedHtml = processedHtml.replace(regex, replaceText);
      } catch {
        processedHtml = processedHtml.split(findText).join(replaceText);
      }
    }

    let tagsRemoved = 0;
    let attrsRemoved = 0;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(processedHtml, 'text/html');

      const allowedTagSet = new Set(
        options.allowedTags
          .toLowerCase()
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      );

      // Recursive node cleaning
      const cleanNode = (node: Node): boolean => {
        // Comment Node
        if (node.nodeType === Node.COMMENT_NODE) {
          if (options.removeComments) {
            tagsRemoved++;
            return false;
          }
          return true;
        }

        // Text Node
        if (node.nodeType === Node.TEXT_NODE) {
          if (node.nodeValue) {
            let val = node.nodeValue;
            if (options.fixSmartQuotes) {
              val = val
                .replace(/[“”]/g, '"')
                .replace(/[‘’]/g, "'")
                .replace(/[–—]/g, '-');
            }
            if (options.removeSuccessiveNbsp) {
              val = val.replace(/(\u00A0|\s)+/g, ' ');
            }
            node.nodeValue = val;
          }
          return true;
        }

        // Element Node
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tagName = el.tagName.toUpperCase();
          const lowerTagName = el.tagName.toLowerCase();

          // 1. Script / Style removals
          if (
            (options.stripScripts && (tagName === 'SCRIPT' || tagName === 'NOSCRIPT')) ||
            (options.stripStyles && tagName === 'STYLE') ||
            (tagName === 'IFRAME' || tagName === 'EMBED' || tagName === 'OBJECT' || tagName === 'APPLET')
          ) {
            tagsRemoved++;
            return false;
          }

          // 2. Remove Images
          if (options.removeImages && tagName === 'IMG') {
            tagsRemoved++;
            return false;
          }

          // 3. Convert deprecated / non-semantic tags
          if (options.convertSemanticTags) {
            if (tagName === 'B') {
              const strong = doc.createElement('strong');
              while (el.firstChild) strong.appendChild(el.firstChild);
              el.parentNode?.replaceChild(strong, el);
              return cleanNode(strong);
            }
            if (tagName === 'I') {
              const em = doc.createElement('em');
              while (el.firstChild) em.appendChild(el.firstChild);
              el.parentNode?.replaceChild(em, el);
              return cleanNode(em);
            }
          }

          // 4. Replace table tags with <div>s
          if (options.replaceTablesWithDivs && ['TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH'].includes(tagName)) {
            const div = doc.createElement('div');
            while (el.firstChild) div.appendChild(el.firstChild);
            el.parentNode?.replaceChild(div, el);
            return cleanNode(div);
          }

          // 5. Attributes cleaning
          if (options.stripTagAttributes) {
            const attrs = Array.from(el.attributes);
            for (const attr of attrs) {
              if (tagName === 'A' && attr.name.toLowerCase() === 'href') continue;
              if (tagName === 'IMG' && (attr.name.toLowerCase() === 'src' || attr.name.toLowerCase() === 'alt')) continue;
              el.removeAttribute(attr.name);
              attrsRemoved++;
            }
          } else {
            const attrs = Array.from(el.attributes);
            for (const attr of attrs) {
              const attrName = attr.name.toLowerCase();

              if (options.stripInlineStyles && attrName === 'style') {
                el.removeAttribute(attr.name);
                attrsRemoved++;
              }
              if (options.stripClassesAndIds && (attrName === 'class' || attrName === 'id')) {
                el.removeAttribute(attr.name);
                attrsRemoved++;
              }
              if (attrName.startsWith('on') || attr.value.toLowerCase().trim().startsWith('javascript:')) {
                el.removeAttribute(attr.name);
                attrsRemoved++;
              }
              if (options.removeAriaAttributes && (attrName.startsWith('aria-') || attrName === 'role')) {
                el.removeAttribute(attr.name);
                attrsRemoved++;
              }
              if (
                attrName.startsWith('xmlns') ||
                attrName.startsWith('mso-') ||
                attrName.startsWith('v:') ||
                attrName.startsWith('o:') ||
                attrName.startsWith('data-') ||
                attrName === 'dir' ||
                attrName === 'align' ||
                attrName === 'lang' ||
                attrName === 'valign' ||
                attrName === 'border' ||
                attrName === 'cellpadding' ||
                attrName === 'cellspacing' ||
                attrName === 'bgcolor' ||
                attrName === 'width' ||
                attrName === 'height' ||
                attrName === 'frame' ||
                attrName === 'rules'
              ) {
                el.removeAttribute(attr.name);
                attrsRemoved++;
              }
            }
          }

          // 6. Clean children first recursively
          const children = Array.from(el.childNodes);
          for (const child of children) {
            const keep = cleanNode(child);
            if (!keep) {
              el.removeChild(child);
            }
          }

          // 7. Whitelist check
          if (options.tagWhitelistMode && !allowedTagSet.has(lowerTagName)) {
            tagsRemoved++;
            const parent = el.parentNode;
            if (parent) {
              while (el.firstChild) {
                parent.insertBefore(el.firstChild, el);
              }
            }
            return false;
          }

          // 8. Tag unwraps
          if (options.removeAllTags) {
            tagsRemoved++;
            const parent = el.parentNode;
            if (parent) {
              while (el.firstChild) parent.insertBefore(el.firstChild, el);
            }
            return false;
          }

          if (options.removeSpanTags && tagName === 'SPAN') {
            tagsRemoved++;
            const parent = el.parentNode;
            if (parent) {
              while (el.firstChild) parent.insertBefore(el.firstChild, el);
            }
            return false;
          }

          if (options.removeDivTags && tagName === 'DIV') {
            tagsRemoved++;
            const parent = el.parentNode;
            if (parent) {
              while (el.firstChild) parent.insertBefore(el.firstChild, el);
            }
            return false;
          }

          if (options.removeLinks && tagName === 'A') {
            tagsRemoved++;
            const parent = el.parentNode;
            if (parent) {
              while (el.firstChild) parent.insertBefore(el.firstChild, el);
            }
            return false;
          }

          if (options.removeTables && ['TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH'].includes(tagName)) {
            tagsRemoved++;
            const parent = el.parentNode;
            if (parent) {
              while (el.firstChild) parent.insertBefore(el.firstChild, el);
            }
            return false;
          }

          // 9. Remove tags with one &nbsp;
          const selfClosing = ['IMG', 'BR', 'HR', 'INPUT', 'META', 'LINK'];
          const textContent = el.textContent || '';
          const isOnlyNbsp = textContent.replace(/\u00A0/g, ' ').trim() === '' && (el.innerHTML.includes('&nbsp;') || el.innerHTML.includes('\u00A0'));

          if (options.removeTagsWithOneNbsp && isOnlyNbsp && !selfClosing.includes(tagName)) {
            tagsRemoved++;
            return false;
          }

          // 10. Remove empty tags
          const normalizedText = textContent.replace(/\u00A0/g, ' ').trim();
          const hasMediaOrEmbeds = el.querySelectorAll('img, br, hr, input, iframe, svg, canvas, video, audio').length > 0;
          if (
            options.removeEmptyTags &&
            !selfClosing.includes(tagName) &&
            !normalizedText &&
            !hasMediaOrEmbeds
          ) {
            tagsRemoved++;
            return false;
          }

          return true;
        }

        return true;
      };

      const body = doc.body;
      for (let pass = 0; pass < 3; pass++) {
        const childNodes = Array.from(body.childNodes);
        let removedInPass = false;
        for (const child of childNodes) {
          const keep = cleanNode(child);
          if (!keep) {
            body.removeChild(child);
            removedInPass = true;
          }
        }
        if (!removedInPass) break;
      }

      let rawCleaned = body.innerHTML;

      // Extract plain text
      const plainText = (body.textContent || '').replace(/\n\s*\n/g, '\n\n').trim();

      // Formatting HTML Output
      let finalHtml = rawCleaned;
      if (options.setNewLinesAndIndents || options.formatting === 'pretty') {
        finalHtml = formatHtmlString(rawCleaned);
      } else if (options.formatting === 'minify') {
        finalHtml = rawCleaned
          .replace(/>\s+</g, '><')
          .replace(/\s+/g, ' ')
          .trim();
      } else {
        finalHtml = rawCleaned.trim();
      }

      const inputBytes = new Blob([inputHtml]).size;
      const outputBytes = new Blob([finalHtml]).size;
      const reductionPct = inputBytes > 0 ? Math.round(((inputBytes - outputBytes) / inputBytes) * 100) : 0;
      const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;

      return {
        html: finalHtml,
        markdown: '',
        text: plainText,
        stats: {
          inputBytes,
          outputBytes,
          tagsRemoved,
          attrsRemoved,
          reductionPct: Math.max(0, reductionPct),
          wordCount
        }
      };
    } catch {
      return {
        html: inputHtml,
        markdown: inputHtml,
        text: inputHtml,
        stats: { inputBytes: 0, outputBytes: 0, tagsRemoved: 0, attrsRemoved: 0, reductionPct: 0, wordCount: 0 }
      };
    }
  }, [inputHtml, options, findText, replaceText]);

  // Keep rightCodeHtml synced with cleanedResult.html unless user is actively typing in the right code textarea
  useEffect(() => {
    if (document.activeElement !== rightTextareaRef.current) {
      setRightCodeHtml(cleanedResult.html);
    }
  }, [cleanedResult.html]);

  const handleRightCodeChange = (newVal: string) => {
    setRightCodeHtml(newVal);
    setInputHtml(newVal);
  };

  // Helper formatting function for pretty HTML
  function formatHtmlString(html: string): string {
    let formatted = '';
    let indent = '';
    const tab = '  ';
    const tokens = html.split(/(<[^>]+>)/g).filter(Boolean);

    for (let token of tokens) {
      token = token.trim();
      if (!token) continue;

      if (token.startsWith('</')) {
        indent = indent.substring(tab.length);
        formatted += `\n${indent}${token}`;
      } else if (token.startsWith('<') && !token.startsWith('<!--') && !token.endsWith('/>') && !token.startsWith('<!')) {
        const isSelfClosing = /<(img|br|hr|input|meta|link|source|track)[^>]*>/i.test(token);
        formatted += `\n${indent}${token}`;
        if (!isSelfClosing) {
          indent += tab;
        }
      } else if (token.startsWith('<')) {
        formatted += `\n${indent}${token}`;
      } else {
        formatted += `${token}`;
      }
    }

    return formatted.trim();
  }

  // Copy handler
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download handler
  const handleDownload = () => {
    const content = rightCodeHtml || cleanedResult.html;
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cleaned-content.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Exec WYSIWYG command
  const execWysiwygCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (wysiwygRef.current) {
      setInputHtml(wysiwygRef.current.innerHTML);
    }
  };

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) setInputHtml(event.target.result as string);
      };
      reader.readAsText(file);
    }
  };

  // Check if master checkbox is checked
  const isMasterChecked = MAIN_CLEANING_OPTIONS.every(
    (opt) => options[opt.key as keyof CleanOptions] as boolean
  );

  const handleMasterToggle = () => {
    const targetVal = !isMasterChecked;
    const updated = { ...options };
    MAIN_CLEANING_OPTIONS.forEach((opt) => {
      (updated as any)[opt.key] = targetVal;
    });
    setOptions(updated);
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-sky-600" />
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                HTML Cleaner & Visual Editor
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live dual-window HTML cleaner with visual content editor and real-time code output.
            </p>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setOptions(DEFAULT_OPTIONS)}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200/80 cursor-pointer transition-colors flex items-center gap-1.5 shadow-2xs"
              title="Reset to default screenshot options"
            >
              <RefreshCw className="h-3.5 w-3.5 text-sky-600" />
              <span>Default Options</span>
            </button>
            <button
              onClick={() => setInputHtml(SAMPLE_HTML_WORD_DOC)}
              className="px-2 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors flex items-center gap-1"
            >
              <FileCode className="h-3.5 w-3.5 text-slate-400" />
              <span>Word Sample</span>
            </button>
            <button
              onClick={() => setInputHtml(SAMPLE_HTML_SCRAPED)}
              className="px-2 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors flex items-center gap-1"
            >
              <Globe className="h-3.5 w-3.5 text-slate-400" />
              <span>Web Sample</span>
            </button>
            <button
              onClick={() => setShowReplaceBar(!showReplaceBar)}
              className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                showReplaceBar ? 'bg-sky-100 border-sky-300 text-sky-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title="Find & Replace Utility"
            >
              <Replace className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setInputHtml(''); setFindText(''); setReplaceText(''); }}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Clear All Editors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Find and Replace Utility Bar */}
        <AnimatePresence>
          {showReplaceBar && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 overflow-hidden"
            >
              <input
                type="text"
                placeholder="Find (text or regex)..."
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                className="flex-1 min-w-[180px] px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <input
                type="text"
                placeholder="Replace with..."
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className="flex-1 min-w-[180px] px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* DUAL EDITABLE WINDOWS WORKSPACE (Visual Content Editor on Left, HTML Code Editor on Right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 h-[clamp(550px,70vh,820px)]">
        {/* WINDOW 1: VISUAL CONTENT EDITOR (Editable Content) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col h-full min-h-0">
          {/* Window Header */}
          <div className="bg-slate-900 text-slate-200 px-3.5 py-2.5 flex items-center justify-between gap-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-sky-400" />
              <span className="font-bold text-xs tracking-tight text-white">Visual Content</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                title="Upload File"
              >
                <Upload className="h-3 w-3" />
                <span>Upload</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm,.txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      if (ev.target?.result) setInputHtml(ev.target.result as string);
                    };
                    reader.readAsText(file);
                  }
                }}
              />
            </div>
          </div>

          {/* WYSIWYG Formatting Toolbar */}
          <div className="p-1.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center gap-1 text-slate-700">
            <button
              onClick={() => execWysiwygCommand('bold')}
              className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300 cursor-pointer"
              title="Bold"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => execWysiwygCommand('italic')}
              className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300 cursor-pointer"
              title="Italic"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <div className="h-3.5 w-px bg-slate-300 mx-0.5" />
            <button
              onClick={() => execWysiwygCommand('formatBlock', '<h1>')}
              className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300 cursor-pointer"
              title="Heading 1"
            >
              <Heading1 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => execWysiwygCommand('formatBlock', '<h2>')}
              className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300 cursor-pointer"
              title="Heading 2"
            >
              <Heading2 className="h-3.5 w-3.5" />
            </button>
            <div className="h-3.5 w-px bg-slate-300 mx-0.5" />
            <button
              onClick={() => execWysiwygCommand('insertUnorderedList')}
              className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300 cursor-pointer"
              title="Bullet List"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => execWysiwygCommand('insertOrderedList')}
              className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300 cursor-pointer"
              title="Numbered List"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </button>
            <div className="h-3.5 w-px bg-slate-300 mx-0.5" />
            <button
              onClick={() => execWysiwygCommand('removeFormat')}
              className="p-1 hover:bg-white rounded border border-transparent hover:border-slate-300 text-rose-600 cursor-pointer"
              title="Clear Formatting"
            >
              <Eraser className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Editable Content Window Area */}
          <div
            className={`flex-1 flex flex-col relative bg-white min-h-0 ${
              dragActive ? 'bg-sky-50/50 ring-2 ring-sky-500 ring-inset' : ''
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <div
              ref={wysiwygRef}
              contentEditable
              onInput={(e) => setInputHtml((e.target as HTMLElement).innerHTML)}
              className="flex-1 p-4 font-sans text-xs text-slate-800 focus:outline-none overflow-y-auto leading-relaxed prose prose-slate max-w-none min-h-0"
            />
          </div>
        </div>

        {/* WINDOW 2: HTML CODE EDITOR (Editable Code) */}
        <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-2xs overflow-hidden flex flex-col h-full min-h-0 text-slate-100">
          {/* Window Header */}
          <div className="bg-slate-900 px-3.5 py-2.5 flex items-center justify-between gap-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="font-bold text-xs tracking-tight text-white">HTML Code</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleCopy(rightCodeHtml || cleanedResult.html)}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 flex items-center gap-1 cursor-pointer transition-colors"
                title="Copy Clean Code"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={handleDownload}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                title="Download Clean File"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Editable HTML Code Area */}
          <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden min-h-0">
            <textarea
              ref={rightTextareaRef}
              value={rightCodeHtml}
              onChange={(e) => handleRightCodeChange(e.target.value)}
              placeholder="Cleaned HTML code will appear here (live editable)..."
              className="w-full flex-1 p-4 font-mono text-xs text-slate-200 bg-transparent focus:outline-none resize-none leading-relaxed selection:bg-sky-600 focus:ring-1 focus:ring-sky-500/50 min-h-0 overflow-y-auto"
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      {/* PANEL BELOW: CLEANING OPTIONS CHECKBOXES DIV */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden flex flex-col">
        {/* Header styled like screenshot (Dark Blue bar with master checkbox) */}
        <div className="bg-[#3b5998] text-white px-4 py-2.5 flex items-center justify-between shadow-xs border-b border-[#2d4373]">
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={isMasterChecked}
              onChange={handleMasterToggle}
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400 cursor-pointer bg-white"
              title="Select / Deselect All Options"
            />
            <span className="font-bold text-sm tracking-wide text-white">Cleaning options</span>
          </div>
          <div className="text-xs text-slate-200 font-medium">
            {cleanedResult.stats.tagsRemoved + cleanedResult.stats.attrsRemoved} operations performed
          </div>
        </div>

        {/* 14 Checklist Options rendered in a multi-column grid below the windows */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 bg-white">
          {MAIN_CLEANING_OPTIONS.map(({ key, label, icon: Icon }) => {
            const isChecked = options[key as keyof CleanOptions] as boolean;
            return (
              <label
                key={key}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-slate-100 hover:border-sky-200 hover:bg-sky-50/50 cursor-pointer select-none transition-all group"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => setOptions({ ...options, [key]: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
                <Icon className="h-4 w-4 text-slate-500 group-hover:text-sky-600 shrink-0 transition-colors" />
                <span className={`text-xs transition-colors ${isChecked ? 'text-slate-900 font-semibold' : 'text-slate-600 font-medium'}`}>
                  {label}
                </span>
              </label>
            );
          })}
        </div>

        {/* Summary Footer */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <span>Toggle options above to customize real-time cleaning rules</span>
          <span className="font-bold font-mono text-emerald-600">{cleanedResult.stats.reductionPct}% smaller</span>
        </div>
      </div>
    </div>
  );
}
