import React, { useState, useMemo, useRef, useEffect, useDeferredValue } from 'react';
import {
  Code,
  FileCode,
  Copy,
  Check,
  Download,
  Trash2,
  Sparkles,
  Eye,
  FileText,
  CheckCircle2,
  Info,
  Upload,
  Replace,
  Zap,
  Globe,
  ShieldAlert,
  ListFilter,
  Image as ImageIcon,
  Link2,
  Table as TableIcon,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Pilcrow,
  List,
  ListOrdered,
  Quote,
  Eraser,
  Layers,
  Wrench,
  RefreshCw,
  Table,
  FileSpreadsheet,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { copyText, escapeHtml, semanticTagsForInlineStyle } from '../../lib/utils';

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
  removeEmptyTags: true,
  removeTagsWithOneNbsp: true,
  removeSpanTags: true,
  removeDivTags: true,
  removeImages: false,
  removeLinks: false,
  removeTables: false,
  replaceTablesWithDivs: false,
  removeComments: true,
  removeAriaAttributes: true,
  setNewLinesAndIndents: true,

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
  { key: 'removeComments', label: 'Remove comments & MSO tags', icon: Info },
  { key: 'removeAriaAttributes', label: 'Remove ARIA attributes', icon: ShieldAlert },
  { key: 'setNewLinesAndIndents', label: 'Set new lines and indents', icon: ListFilter },
  { key: 'stripScripts', label: 'Remove scripts & embeds', icon: ShieldAlert },
  { key: 'stripStyles', label: 'Remove <style> blocks', icon: FileCode },
  { key: 'convertSemanticTags', label: 'Convert b/i to strong/em', icon: Sparkles },
  { key: 'fixSmartQuotes', label: 'Normalize smart quotes', icon: Sparkles },
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
      <p class="MsoNormal">&nbsp;</p>
      <script type="text/javascript">
        console.log("Tracking script should be stripped automatically!");
      </script>
      <table border="1" cellpadding="5" cellspacing="0" style="width:100%; border-collapse:collapse;">
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

const SAMPLE_HTML_TABLE = `<table border="1" cellpadding="6" cellspacing="0" style="width:100%; border-collapse:collapse; font-family:sans-serif;" bgcolor="#ffffff">
  <thead>
    <tr bgcolor="#2563eb" style="color:#ffffff;">
      <th style="padding:10px; text-align:left;">Utility Name</th>
      <th style="padding:10px; text-align:left;">Category</th>
      <th style="padding:10px; text-align:center;">Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:8px;">HTML Cleaner & Visual Studio</td>
      <td style="padding:8px;"><span style="color:#2563eb;">Code & Markup</span></td>
      <td style="padding:8px; text-align:center;"><b>Ready</b></td>
    </tr>
    <tr bgcolor="#f8fafc">
      <td style="padding:8px;">Bulk Image Converter</td>
      <td style="padding:8px;"><span style="color:#059669;">Graphics</span></td>
      <td style="padding:8px; text-align:center;"><b>Ready</b></td>
    </tr>
    <tr>
      <td style="padding:8px;">Responsive Device Preview</td>
      <td style="padding:8px;"><span style="color:#7c3aed;">UI Testing</span></td>
      <td style="padding:8px; text-align:center;"><b>Ready</b></td>
    </tr>
  </tbody>
</table>`;

type NodeCrumb = { tag: string; id: string; classes: string[] };

type WysiwygTool = {
  divider?: boolean;
  command?: string;
  value?: string;
  block?: string;
  label?: string;
  icon?: React.ElementType;
  danger?: boolean;
};

const WYSIWYG_TOOLS: WysiwygTool[] = [
  { command: 'bold', label: 'Bold', icon: Bold },
  { command: 'italic', label: 'Italic', icon: Italic },
  { command: 'underline', label: 'Underline', icon: Underline },
  { command: 'strikeThrough', label: 'Strikethrough', icon: Strikethrough },
  { divider: true },
  { command: 'formatBlock', value: '<p>', block: 'p', label: 'Paragraph', icon: Pilcrow },
  { command: 'formatBlock', value: '<h1>', block: 'h1', label: 'Heading 1', icon: Heading1 },
  { command: 'formatBlock', value: '<h2>', block: 'h2', label: 'Heading 2', icon: Heading2 },
  { command: 'formatBlock', value: '<h3>', block: 'h3', label: 'Heading 3', icon: Heading3 },
  { command: 'formatBlock', value: '<h4>', block: 'h4', label: 'Heading 4', icon: Heading4 },
  { command: 'formatBlock', value: '<h5>', block: 'h5', label: 'Heading 5', icon: Heading5 },
  { command: 'formatBlock', value: '<h6>', block: 'h6', label: 'Heading 6', icon: Heading6 },
  { divider: true },
  { command: 'insertUnorderedList', label: 'Bullet List', icon: List },
  { command: 'insertOrderedList', label: 'Numbered List', icon: ListOrdered },
  { command: 'formatBlock', value: '<blockquote>', block: 'blockquote', label: 'Quote Block', icon: Quote },
  { divider: true },
  { command: 'createLink', label: 'Insert Link', icon: Link2 },
  { command: 'removeFormat', label: 'Clear Formatting', icon: Eraser, danger: true },
];

const INLINE_STATE_COMMANDS = ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList'];

// Format bytes helper
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const INERT_REMOVE_SELECTOR = 'script, noscript, style, link, meta, base, iframe, frame, frameset, object, embed, applet';
const URL_ATTRIBUTES = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'srcdoc']);

// The visual editor renders pasted HTML inside the app itself, so anything that can run code
// (event handlers, script URLs) or restyle the app (<style>, <link>) must never reach it.
function toInertEditorHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll(INERT_REMOVE_SELECTOR).forEach((el) => el.remove());
  doc.body.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || (URL_ATTRIBUTES.has(name) && /^\s*(javascript|vbscript):/i.test(attr.value))) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return doc.body.innerHTML;
}

function literalSearch(text: string): RegExp {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
}

const REGEX_TIMEOUT_MS = 1000;
const REGEX_WORKER_SOURCE = `onmessage = (e) => {
  const { pattern, input, replacement } = e.data;
  try {
    const re = new RegExp(pattern, 'gi');
    const count = (input.match(re) || []).length;
    postMessage({ count, output: replacement === undefined ? undefined : input.replace(re, replacement) });
  } catch (err) {
    postMessage({ error: 'Invalid pattern: ' + err.message });
  }
};`;

type RegexResult = { count: number; output?: string } | { error: string };

// A user-typed pattern can backtrack for minutes; in a worker it can be killed instead of freezing the app.
function runRegexInWorker(pattern: string, input: string, replacement?: string): Promise<RegexResult> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([REGEX_WORKER_SOURCE], { type: 'text/javascript' }));
    const worker = new Worker(url);
    const finish = (result: RegexResult) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(result);
    };
    const timer = setTimeout(() => finish({ error: 'Pattern took too long and was stopped' }), REGEX_TIMEOUT_MS);
    worker.onmessage = (event) => finish(event.data);
    worker.onerror = (event) => { event.preventDefault(); finish({ error: event.message || 'Invalid pattern' }); };
    worker.postMessage({ pattern, input, replacement });
  });
}

const PLAIN_TEXT_BLOCKS ='p, div, h1, h2, h3, h4, h5, h6, li, tr, blockquote, table, ul, ol, section, article, header, footer, figure, figcaption, hr';
const PLAIN_TEXT_PARAGRAPHS = 'p, h1, h2, h3, h4, h5, h6, blockquote, table';
const PARAGRAPH_BREAK = '\u0001';
const PRE_TOKEN = '\u0002';

// Text view: one line per block, a blank line after paragraphs, code blocks verbatim.
function htmlBodyToPlainText(body: HTMLElement): string {
  const copy = body.cloneNode(true) as HTMLElement;
  const preBlocks: string[] = [];
  copy.querySelectorAll('pre').forEach((pre) => {
    preBlocks.push(pre.textContent || '');
    pre.replaceWith('\n', `${PRE_TOKEN}${preBlocks.length - 1}${PRE_TOKEN}`, PARAGRAPH_BREAK);
  });
  copy.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  copy.querySelectorAll('td, th').forEach((cell) => cell.after('\t'));
  copy.querySelectorAll(PLAIN_TEXT_BLOCKS).forEach((block) => { block.before('\n'); block.after('\n'); });
  copy.querySelectorAll(PLAIN_TEXT_PARAGRAPHS).forEach((block) => block.after(PARAGRAPH_BREAK));
  return (copy.textContent || '')
    .split('\n')
    .map((line) => line.replace(/[ \t ]+$/, '').replace(/[  ]+/g, ' ').replace(/ ?\t ?/g, '\t').trim())
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .replace(new RegExp(`\\s*(${PARAGRAPH_BREAK}\\s*)+`, 'g'), '\n\n')
    .replace(new RegExp(`${PRE_TOKEN}(\\d+)${PRE_TOKEN}`, 'g'), (_, index) => preBlocks[Number(index)])
    .trim();
}

// Convert HTML to clean Markdown
function htmlToMarkdown(html: string): string {
  if (!html.trim()) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const processNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue || '';
      // A literal "<div>" in the copy must stay text, not become raw HTML in the Markdown.
      return node.parentElement?.closest('pre, code') ? text : text.replace(/</g, '\\<');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const childrenText = Array.from(el.childNodes).map(processNode).join('');

    switch (tag) {
      case 'h1': return `\n\n# ${childrenText.trim()}\n\n`;
      case 'h2': return `\n\n## ${childrenText.trim()}\n\n`;
      case 'h3': return `\n\n### ${childrenText.trim()}\n\n`;
      case 'h4': return `\n\n#### ${childrenText.trim()}\n\n`;
      case 'h5': return `\n\n##### ${childrenText.trim()}\n\n`;
      case 'h6': return `\n\n###### ${childrenText.trim()}\n\n`;
      case 'p': return `\n\n${childrenText.trim()}\n\n`;
      case 'strong':
      case 'b':
        return childrenText.trim() ? `**${childrenText.trim()}**` : '';
      case 'em':
      case 'i':
        return childrenText.trim() ? `*${childrenText.trim()}*` : '';
      case 's':
      case 'strike':
      case 'del':
        return childrenText.trim() ? `~~${childrenText.trim()}~~` : '';
      case 'code':
        if (el.parentElement?.tagName.toLowerCase() === 'pre') {
          return childrenText;
        }
        return `\`${childrenText}\``;
      case 'pre':
        return `\n\n\`\`\`\n${el.textContent || childrenText}\n\`\`\`\n\n`;
      case 'blockquote':
        return `\n\n> ${childrenText.trim().replace(/\n/g, '\n> ')}\n\n`;
      case 'a': {
        const href = el.getAttribute('href') || '#';
        return `[${childrenText.trim() || href}](${href})`;
      }
      case 'img': {
        const src = el.getAttribute('src') || '';
        const alt = el.getAttribute('alt') || 'image';
        return `![${alt}](${src})`;
      }
      case 'hr': return '\n\n---\n\n';
      case 'br': return '  \n';
      case 'ul':
      case 'ol': {
        const items = Array.from(el.children)
          .filter((c) => c.tagName.toLowerCase() === 'li')
          .map((c, i) => {
            const marker = tag === 'ol' ? `${i + 1}. ` : '- ';
            const body = Array.from(c.childNodes).map(processNode).join('').trim().replace(/\n{2,}/g, '\n');
            // Continuation lines (nested lists, wrapped paragraphs) indent under the marker.
            return marker + body.replace(/\n/g, `\n${' '.repeat(marker.length)}`);
          })
          .join('\n');
        return `\n\n${items}\n\n`;
      }
      case 'table': {
        const rows = Array.from(el.querySelectorAll('tr'));
        if (rows.length === 0) return '';
        let tableMd = '\n\n';
        rows.forEach((row, idx) => {
          const cells = Array.from(row.querySelectorAll('th, td')).map((c) =>
            Array.from(c.childNodes).map(processNode).join('').replace(/\|/g, '\\|').trim()
          );
          tableMd += `| ${cells.join(' | ')} |\n`;
          if (idx === 0) {
            tableMd += `| ${cells.map(() => '---').join(' | ')} |\n`;
          }
        });
        return tableMd + '\n';
      }
      default:
        return childrenText;
    }
  };

  return processNode(doc.body).replace(/\n{3,}/g, '\n\n').trim();
}

const PRETTY_BLOCK_TAGS = new Set([
  'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'blockquote',
  'header', 'footer', 'nav', 'section', 'article', 'aside', 'main', 'figure', 'figcaption', 'hr'
]);
const PRETTY_VOID_TAGS = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'track', 'wbr']);

function startsOwnLine(node: Node): boolean {
  if (node.nodeType === Node.COMMENT_NODE) return true;
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const tag = (node as HTMLElement).tagName.toLowerCase();
  return tag === 'pre' || PRETTY_BLOCK_TAGS.has(tag);
}

// Blocks go on their own lines; each run of inline content between them stays together on one line.
function prettyPrintChildren(nodes: ArrayLike<Node>, indentLevel: number): string {
  const indent = '  '.repeat(indentLevel);
  let output = '';
  let inlineRun = '';
  const flushInlineRun = () => {
    const line = inlineRun.trim();
    if (line) output += `\n${indent}${line}`;
    inlineRun = '';
  };
  for (const child of Array.from(nodes)) {
    if (startsOwnLine(child)) {
      flushInlineRun();
      output += prettyPrintDom(child, indentLevel);
    } else {
      inlineRun += prettyPrintDom(child, indentLevel);
    }
  }
  flushInlineRun();
  return output;
}

function prettyPrintDom(node: Node, indentLevel = 0): string {
  const indent = '  '.repeat(indentLevel);
  const blockTags = PRETTY_BLOCK_TAGS;
  const voidTags = PRETTY_VOID_TAGS;

  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.nodeValue?.replace(/\s+/g, ' ') || '');
  }
  if (node.nodeType === Node.COMMENT_NODE) {
    return `\n${indent}<!--${node.nodeValue}-->`;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === 'pre') {
    return `\n${indent}<pre>${el.innerHTML}</pre>`;
  }

  const isBlock = blockTags.has(tag);
  const isVoid = voidTags.has(tag);

  let attrs = '';
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i];
    attrs += ` ${attr.name}="${escapeHtml(attr.value)}"`;
  }

  if (isVoid) {
    return isBlock ? `\n${indent}<${tag}${attrs} />` : `<${tag}${attrs} />`;
  }

  const hasBlockChildren = Array.from(el.childNodes).some(
    (c) => c.nodeType === Node.ELEMENT_NODE && blockTags.has((c as HTMLElement).tagName.toLowerCase())
  );

  if (!hasBlockChildren) {
    const inner = Array.from(el.childNodes).map((c) => prettyPrintDom(c, 0)).join('').trim();
    if (!inner) return `<${tag}${attrs}></${tag}>`;
    return isBlock ? `\n${indent}<${tag}${attrs}>${inner}</${tag}>` : `<${tag}${attrs}>${inner}</${tag}>`;
  }

  return `\n${indent}<${tag}${attrs}>${prettyPrintChildren(el.childNodes, indentLevel + 1)}\n${indent}</${tag}>`;
}

export default function HtmlCleaner() {
  const [inputHtml, setInputHtml] = useState<string>(SAMPLE_HTML_WORD_DOC);
  const [options, setOptions] = useState<CleanOptions>(DEFAULT_OPTIONS);
  const [activeView, setActiveView] = useState<'html' | 'markdown' | 'text'>('html');
  const [copied, setCopied] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [findText, setFindText] = useState<string>('');
  const [replaceText, setReplaceText] = useState<string>('');
  const [useRegex, setUseRegex] = useState<boolean>(false);
  const [findStatus, setFindStatus] = useState<{ count: number; error?: string }>({ count: 0 });
  const matchCount = findStatus.count;
  const [showReplaceBar, setShowReplaceBar] = useState<boolean>(false);
  const [rightCodeHtml, setRightCodeHtml] = useState<string>('');
  const [nodePath, setNodePath] = useState<NodeCrumb[]>([]);
  const [formatState, setFormatState] = useState<{ inline: Record<string, boolean>; block: string }>({ inline: {}, block: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const wysiwygRef = useRef<HTMLDivElement>(null);
  const rightTextareaRef = useRef<HTMLTextAreaElement>(null);

  const describeNode = (node: Node | null | undefined) => {
    const root = wysiwygRef.current;
    if (!root || !node) return;
    let el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
    if (!el || !root.contains(el)) return;

    const crumbs: NodeCrumb[] = [];
    while (el && el !== root) {
      crumbs.unshift({ tag: el.tagName.toLowerCase(), id: el.id, classes: Array.from(el.classList) });
      el = el.parentElement;
    }
    setNodePath(crumbs);

    const inline: Record<string, boolean> = {};
    for (const command of INLINE_STATE_COMMANDS) {
      try { inline[command] = document.queryCommandState(command); } catch { inline[command] = false; }
    }
    let block = '';
    try { block = String(document.queryCommandValue('formatBlock') || '').toLowerCase(); } catch {}
    if (!block) block = crumbs.find((crumb) => /^(p|h[1-6]|blockquote|pre|div)$/.test(crumb.tag))?.tag ?? '';
    setFormatState({ inline, block });
  };

  useEffect(() => {
    const onSelectionChange = () => describeNode(document.getSelection()?.anchorNode);
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  useEffect(() => {
    if (wysiwygRef.current && document.activeElement !== wysiwygRef.current) {
      wysiwygRef.current.innerHTML = toInertEditorHtml(inputHtml);
    }
  }, [inputHtml]);

  // Cleaning re-parses the whole document; deferring it keeps typing responsive on large pastes.
  const cleaningInput = useDeferredValue(inputHtml);

  const cleanedResult = useMemo(() => {
    if (!cleaningInput.trim()) {
      return {
        html: '',
        markdown: '',
        text: '',
        stats: { inputBytes: 0, outputBytes: 0, tagsRemoved: 0, attrsRemoved: 0, reductionPct: 0, wordCount: 0 }
      };
    }

    let processedHtml = cleaningInput;

    // 1. String Pre-Clean: strip XML namespaces, MSO conditionals & Google Docs artifacts
    processedHtml = processedHtml
      .replace(/<\?xml[^>]*\?>/gi, '')
      .replace(/<!\[if !?[^\]]*\]>/gi, '')
      .replace(/<!\[endif\]>/gi, '')
      .replace(/<\/?o:p[^>]*>/gi, '')
      .replace(/<\/?w:[^>]*>/gi, '')
      .replace(/<\/?m:[^>]*>/gi, '')
      .replace(/<\/?v:[^>]*>/gi, '');

    processedHtml = processedHtml.replace(
      /<b\s+[^>]*id="docs-internal-guid-[^"]*"[^>]*style="[^"]*font-weight:\s*normal[^"]*"[^>]*>(.*?)<\/b>/gis,
      '$1'
    );

    let tagsRemoved = 0;
    let attrsRemoved = 0;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(processedHtml, 'text/html');
      const body = doc.body;

      const allowedTagSet = new Set(
        options.allowedTags
          .toLowerCase()
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      );

      if (options.convertSemanticTags) {
        body.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
          if (!el.firstChild) return;
          for (const tag of semanticTagsForInlineStyle(el.style)) {
            if (el.closest(tag)) continue;
            const soleChild = el.childNodes.length === 1 ? el.firstChild : null;
            if (soleChild?.nodeType === Node.ELEMENT_NODE
              && (soleChild as HTMLElement).tagName.toLowerCase() === tag) continue;

            const wrapper = doc.createElement(tag);
            while (el.firstChild) wrapper.appendChild(el.firstChild);
            el.appendChild(wrapper);
          }
        });
      }

      // Safe DOM unwrap helper
      const unwrapElement = (el: HTMLElement) => {
        const parent = el.parentNode;
        if (!parent) return;
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
        tagsRemoved++;
      };

      // Node cleaner function
      const cleanNode = (node: Node): boolean => {
        // Comment Node
        if (node.nodeType === Node.COMMENT_NODE) {
          if (options.removeComments) {
            node.parentNode?.removeChild(node);
            tagsRemoved++;
            return false;
          }
          return true;
        }

        // Text Node
        if (node.nodeType === Node.TEXT_NODE) {
          // Code blocks keep their exact characters and indentation.
          if (node.nodeValue && !node.parentElement?.closest('pre, textarea')) {
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
          let el = node as HTMLElement;
          const tagName = el.tagName.toUpperCase();
          const lowerTagName = el.tagName.toLowerCase();

          // 1. Script / Style / Object removals
          if (
            (options.stripScripts && ['SCRIPT', 'NOSCRIPT', 'IFRAME', 'EMBED', 'OBJECT', 'APPLET'].includes(tagName)) ||
            (options.stripStyles && tagName === 'STYLE')
          ) {
            el.parentNode?.removeChild(el);
            tagsRemoved++;
            return false;
          }

          // 2. Remove Images
          if (options.removeImages && tagName === 'IMG') {
            el.parentNode?.removeChild(el);
            tagsRemoved++;
            return false;
          }

          // 3. Convert deprecated / non-semantic tags
          if (options.convertSemanticTags) {
            if (tagName === 'B') {
              const fw = el.style.fontWeight;
              if (fw === 'normal' || fw === '400') {
                unwrapElement(el);
                return false;
              }
              const strong = doc.createElement('strong');
              while (el.firstChild) strong.appendChild(el.firstChild);
              el.parentNode?.replaceChild(strong, el);
              el = strong;
            } else if (tagName === 'I') {
              const em = doc.createElement('em');
              while (el.firstChild) em.appendChild(el.firstChild);
              el.parentNode?.replaceChild(em, el);
              el = em;
            } else if (tagName === 'STRIKE' || tagName === 'S') {
              const del = doc.createElement('del');
              while (el.firstChild) del.appendChild(el.firstChild);
              el.parentNode?.replaceChild(del, el);
              el = del;
            } else if (tagName === 'FONT') {
              unwrapElement(el);
              return false;
            } else if (tagName === 'CENTER') {
              const div = doc.createElement('div');
              while (el.firstChild) div.appendChild(el.firstChild);
              el.parentNode?.replaceChild(div, el);
              el = div;
            }
          }

          // 4. Replace table tags with <div>s or <p>s
          if (options.replaceTablesWithDivs && ['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH'].includes(tagName)) {
            const replacementTag = (tagName === 'TD' || tagName === 'TH') ? 'p' : 'div';
            const rep = doc.createElement(replacementTag);
            while (el.firstChild) rep.appendChild(el.firstChild);
            el.parentNode?.replaceChild(rep, el);
            el = rep;
          }

          // 5. Attributes cleaning
          if (options.stripTagAttributes) {
            const attrs = Array.from(el.attributes);
            for (const attr of attrs) {
              const attrName = attr.name.toLowerCase();
              if (tagName === 'A' && attrName === 'href') {
                if (attr.value.toLowerCase().trim().startsWith('javascript:')) {
                  el.removeAttribute(attr.name);
                  attrsRemoved++;
                }
                continue;
              }
              if (tagName === 'IMG' && (attrName === 'src' || attrName === 'alt' || attrName === 'title')) continue;
              if ((tagName === 'TD' || tagName === 'TH') && (attrName === 'colspan' || attrName === 'rowspan')) continue;
              el.removeAttribute(attr.name);
              attrsRemoved++;
            }
          } else {
            const attrs = Array.from(el.attributes);
            for (const attr of attrs) {
              const attrName = attr.name.toLowerCase();
              const attrVal = attr.value.toLowerCase().trim();

              if (options.stripInlineStyles && attrName === 'style') {
                el.removeAttribute(attr.name);
                attrsRemoved++;
                continue;
              }
              if (options.stripClassesAndIds && (attrName === 'class' || attrName === 'id')) {
                el.removeAttribute(attr.name);
                attrsRemoved++;
                continue;
              }
              if (attrName.startsWith('on') || attrVal.startsWith('javascript:')) {
                el.removeAttribute(attr.name);
                attrsRemoved++;
                continue;
              }
              if (options.removeAriaAttributes && (attrName.startsWith('aria-') || attrName === 'role')) {
                el.removeAttribute(attr.name);
                attrsRemoved++;
                continue;
              }
              if (
                attrName.startsWith('xmlns') ||
                attrName.startsWith('mso-') ||
                attrName.startsWith('v:') ||
                attrName.startsWith('o:') ||
                attrName.startsWith('data-') ||
                ['dir', 'align', 'valign', 'border', 'cellpadding', 'cellspacing', 'bgcolor', 'width', 'height', 'frame', 'rules'].includes(attrName)
              ) {
                el.removeAttribute(attr.name);
                attrsRemoved++;
              }
            }
          }

          // 6. Clean children first recursively
          const children = Array.from(el.childNodes);
          for (const child of children) {
            cleanNode(child);
          }

          // 7. Whitelist check
          if (options.tagWhitelistMode && !allowedTagSet.has(lowerTagName)) {
            unwrapElement(el);
            return false;
          }

          // 8. Tag unwraps ("Remove all tags" is applied after the passes, from the block-aware plain text)

          if (options.removeSpanTags && el.tagName.toUpperCase() === 'SPAN') {
            unwrapElement(el);
            return false;
          }

          if (options.removeDivTags && el.tagName.toUpperCase() === 'DIV') {
            // A div that holds only text is acting as a paragraph; unwrapping it would glue it to its neighbours.
            const wrapsBlocks = Array.from(el.children).some((child) => startsOwnLine(child));
            if (!wrapsBlocks && el.textContent?.replace(/ /g, ' ').trim()) {
              const paragraph = doc.createElement('p');
              while (el.firstChild) paragraph.appendChild(el.firstChild);
              el.parentNode?.replaceChild(paragraph, el);
              tagsRemoved++;
              return false;
            }
            unwrapElement(el);
            return false;
          }

          if (options.removeLinks && el.tagName.toUpperCase() === 'A') {
            unwrapElement(el);
            return false;
          }

          if (options.removeTables && ['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH'].includes(el.tagName.toUpperCase())) {
            unwrapElement(el);
            return false;
          }

          // 9. Remove tags with one &nbsp; (protect table cells unless removeTables active)
          const currentTag = el.tagName.toUpperCase();
          const isTableCol = ['TD', 'TH'].includes(currentTag);
          const isVoid = ['IMG', 'BR', 'HR', 'INPUT', 'META', 'LINK', 'SOURCE', 'TRACK', 'WBR'].includes(currentTag);

          if (options.removeTagsWithOneNbsp && !isVoid && !isTableCol) {
            const inner = el.innerHTML.trim();
            const text = el.textContent || '';
            const isOnlyNbsp = text.replace(/\u00A0/g, ' ').trim() === '' && (inner.includes('&nbsp;') || inner.includes('\u00A0'));
            if (isOnlyNbsp) {
              el.parentNode?.removeChild(el);
              tagsRemoved++;
              return false;
            }
          }

          // 10. Remove empty tags (protect table cells & media)
          if (options.removeEmptyTags && !isVoid && !isTableCol) {
            const hasMedia = el.querySelector('img, br, hr, input, iframe, svg, canvas, video, audio') !== null;
            const text = el.textContent?.replace(/\u00A0/g, ' ').trim();
            if (!hasMedia && !text) {
              el.parentNode?.removeChild(el);
              tagsRemoved++;
              return false;
            }
          }

          return true;
        }

        return true;
      };

      for (let pass = 0; pass < 6; pass++) {
        const initialCount = body.querySelectorAll('*').length;
        const childNodes = Array.from(body.childNodes);
        for (const child of childNodes) {
          cleanNode(child);
        }
        const finalCount = body.querySelectorAll('*').length;
        if (initialCount === finalCount) break;
      }

      const rawCleaned = body.innerHTML;

      // Generate Plain Text and Markdown
      const plainText = htmlBodyToPlainText(body);
      const markdownText = htmlToMarkdown(rawCleaned);

      // Format HTML Output
      let finalHtml = rawCleaned;
      if (options.removeAllTags) {
        // Text with one line per block, escaped so it is still valid HTML content.
        tagsRemoved += body.querySelectorAll('*').length;
        finalHtml = plainText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      } else if (options.formatting === 'minify') {
        // Odd split parts are <pre> blocks, whose whitespace is content.
        finalHtml = rawCleaned
          .split(/(<pre[\s\S]*?<\/pre>)/gi)
          .map((part, i) => (i % 2 ? part : part.replace(/>\s+</g, '><').replace(/\s+/g, ' ')))
          .join('')
          .trim();
      } else if (options.formatting === 'pretty' && options.setNewLinesAndIndents) {
        finalHtml = prettyPrintChildren(body.childNodes, 0).trim();
      } else {
        finalHtml = rawCleaned.trim();
      }

      const inputBytes = new Blob([cleaningInput]).size;
      const outputBytes = new Blob([finalHtml]).size;
      const reductionPct = inputBytes > 0 ? Math.round(((inputBytes - outputBytes) / inputBytes) * 100) : 0;
      const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;

      return {
        html: finalHtml,
        markdown: markdownText,
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
        html: cleaningInput,
        markdown: cleaningInput,
        text: cleaningInput,
        stats: { inputBytes: 0, outputBytes: 0, tagsRemoved: 0, attrsRemoved: 0, reductionPct: 0, wordCount: 0 }
      };
    }
  }, [cleaningInput, options]);

  useEffect(() => {
    if (document.activeElement !== rightTextareaRef.current) {
      setRightCodeHtml(cleanedResult.html);
    }
  }, [cleanedResult.html]);

  // Handle direct code edits in right textarea
  const handleRightCodeChange = (newVal: string) => {
    setRightCodeHtml(newVal);
    setInputHtml(newVal);
  };

  // Find & Replace match counter. Plain-text search is linear and runs inline; regex runs in a worker.
  useEffect(() => {
    if (!findText) { setFindStatus({ count: 0 }); return; }
    if (!useRegex) {
      setFindStatus({ count: inputHtml.match(literalSearch(findText))?.length ?? 0 });
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      runRegexInWorker(findText, inputHtml).then((result) => {
        if (!cancelled) setFindStatus('error' in result ? { count: 0, error: result.error } : { count: result.count });
      });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [inputHtml, findText, useRegex]);

  // Apply replacement permanently to inputHtml
  const handleApplyReplace = async () => {
    if (!findText) return;
    if (useRegex) {
      const result = await runRegexInWorker(findText, inputHtml, replaceText);
      if ('error' in result) { setFindStatus({ count: 0, error: result.error }); return; }
      setInputHtml(result.output ?? inputHtml);
    } else {
      // Function replacer: "$1" or "$&" in the replacement stay literal text.
      setInputHtml((prev) => prev.replace(literalSearch(findText), () => replaceText));
    }
    setFindText('');
    setReplaceText('');
  };

  const currentViewContent = useMemo(() => {
    if (activeView === 'markdown') return cleanedResult.markdown;
    if (activeView === 'text') return cleanedResult.text;
    return rightCodeHtml || cleanedResult.html;
  }, [activeView, cleanedResult, rightCodeHtml]);

  // Copy handler
  const handleCopy = (text: string) => {
    copyText(text).then((ok) => {
      if (!ok) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Export / Download handler
  const handleDownload = () => {
    const ext = activeView === 'markdown' ? 'md' : activeView === 'text' ? 'txt' : 'html';
    const mime = activeView === 'markdown' ? 'text/markdown' : activeView === 'text' ? 'text/plain' : 'text/html';
    const blob = new Blob([currentViewContent], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cleaned-content.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Exec WYSIWYG command
  const execWysiwygCommand = (command: string, value?: string, block?: string) => {
    wysiwygRef.current?.focus();

    if (command === 'createLink') {
      const url = prompt('Enter Web Link URL (e.g. https://example.com):', 'https://');
      if (!url) return;
      document.execCommand('createLink', false, url);
    } else if (block && formatState.block === block && block !== 'p') {
      document.execCommand('formatBlock', false, '<p>');
    } else {
      document.execCommand(command, false, value);
    }

    if (wysiwygRef.current) {
      setInputHtml(wysiwygRef.current.innerHTML);
    }
    describeNode(document.getSelection()?.anchorNode);
  };

  const clearVisualStyles = () => {
    const doc = new DOMParser().parseFromString(inputHtml, 'text/html');
    doc.querySelectorAll('style, meta, link').forEach((el) => el.remove());
    doc.body.querySelectorAll<HTMLElement>('*').forEach((el) => {
      for (const tag of semanticTagsForInlineStyle(el.style)) {
        if (el.closest(tag) || !el.firstChild) continue;
        const wrapper = doc.createElement(tag);
        while (el.firstChild) wrapper.appendChild(el.firstChild);
        el.appendChild(wrapper);
      }
      el.removeAttribute('style');
      el.removeAttribute('class');
      el.removeAttribute('id');
    });
    doc.body.querySelectorAll('span, font').forEach((el) => el.replaceWith(...Array.from(el.childNodes)));
    setInputHtml(doc.body.innerHTML);
  };

  const handleCodePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (activeView !== 'html') return;
    const html = e.clipboardData.getData('text/html');
    if (!html) return;
    e.preventDefault();
    setInputHtml(html);
    e.currentTarget.blur();
  };

  const handleVisualPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (e.clipboardData.getData('text/html')) return;
    const text = e.clipboardData.getData('text/plain');
    if (!/<\/?[a-z][\s\S]*>/i.test(text)) return;
    e.preventDefault();
    document.execCommand('insertHTML', false, toInertEditorHtml(text));
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

  // Master checkbox toggle
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

  // Presets
  const applyWordCleanPreset = () => {
    setOptions({
      ...DEFAULT_OPTIONS,
      stripTagAttributes: false,
      stripInlineStyles: true,
      stripClassesAndIds: true,
      removeComments: true,
      removeSuccessiveNbsp: true,
      removeTagsWithOneNbsp: true,
      removeEmptyTags: true,
      removeSpanTags: true,
      removeDivTags: true,
      convertSemanticTags: true,
      fixSmartQuotes: true,
      stripScripts: true,
      stripStyles: true,
      formatting: 'pretty',
    });
  };

  const applySafeHtml5Preset = () => {
    setOptions({
      ...DEFAULT_OPTIONS,
      stripTagAttributes: false,
      stripInlineStyles: false,
      stripClassesAndIds: false,
      removeComments: true,
      stripScripts: true,
      stripStyles: true,
      removeAriaAttributes: true,
      convertSemanticTags: true,
      removeEmptyTags: true,
      removeSpanTags: false,
      removeDivTags: false,
      removeTables: false,
      replaceTablesWithDivs: false,
      formatting: 'pretty',
    });
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
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
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/80 cursor-pointer transition-colors flex items-center gap-1.5 shadow-2xs"
              title="Reset to default options"
            >
              <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
              <span>Default Options</span>
            </button>

            <button
              onClick={applyWordCleanPreset}
              className="px-2 py-1.5 text-xs font-medium rounded-lg text-slate-700 hover:text-blue-700 hover:bg-blue-50/60 border border-slate-200 cursor-pointer transition-colors flex items-center gap-1"
              title="Preset optimized for Microsoft Word and Google Docs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-blue-500" />
              <span>Word Clean</span>
            </button>

            <button
              onClick={applySafeHtml5Preset}
              className="px-2 py-1.5 text-xs font-medium rounded-lg text-slate-700 hover:text-emerald-700 hover:bg-emerald-50/60 border border-slate-200 cursor-pointer transition-colors flex items-center gap-1"
              title="Preset for clean semantic HTML5"
            >
              <ShieldAlert className="h-3.5 w-3.5 text-emerald-500" />
              <span>Safe HTML5</span>
            </button>

            <div className="h-4 w-px bg-slate-200 mx-0.5 hidden sm:block" />

            <button
              onClick={() => setInputHtml(SAMPLE_HTML_WORD_DOC)}
              className="px-2 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors flex items-center gap-1"
              title="Load MS Word sample markup"
            >
              <FileCode className="h-3.5 w-3.5 text-slate-400" />
              <span>Word Sample</span>
            </button>

            <button
              onClick={() => setInputHtml(SAMPLE_HTML_SCRAPED)}
              className="px-2 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors flex items-center gap-1"
              title="Load scraped web page markup"
            >
              <Globe className="h-3.5 w-3.5 text-slate-400" />
              <span>Web Sample</span>
            </button>

            <button
              onClick={() => setInputHtml(SAMPLE_HTML_TABLE)}
              className="px-2 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors flex items-center gap-1"
              title="Load dirty table markup"
            >
              <Table className="h-3.5 w-3.5 text-slate-400" />
              <span>Table Sample</span>
            </button>

            <button
              onClick={() => setShowReplaceBar(!showReplaceBar)}
              className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                showReplaceBar ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
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
              <div className="relative flex-1 min-w-[180px]">
                <input
                  type="text"
                  placeholder={useRegex ? 'Find (regular expression)...' : 'Find text...'}
                  aria-label="Find"
                  aria-invalid={Boolean(findStatus.error)}
                  value={findText}
                  onChange={(e) => setFindText(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-16"
                />
                {findText && (
                  <span className="absolute right-2.5 top-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                    {matchCount} {matchCount === 1 ? 'match' : 'matches'}
                  </span>
                )}
              </div>

              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useRegex}
                  onChange={(e) => setUseRegex(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 cursor-pointer"
                />
                Regex
              </label>

              <input
                type="text"
                aria-label="Replace with"
                placeholder="Replace with..."
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className="flex-1 min-w-[180px] px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <button
                onClick={handleApplyReplace}
                disabled={!findText || matchCount === 0}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
              >
                Replace All
              </button>

              {findStatus.error && (
                <p role="alert" className="basis-full text-xs font-medium text-red-600">{findStatus.error}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* DUAL EDITABLE WINDOWS WORKSPACE (Visual Content Editor on Left, HTML Code Editor on Right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:h-[clamp(550px,70vh,820px)]">
        {/* WINDOW 1: VISUAL CONTENT EDITOR (Editable Content) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col h-[70vh] md:h-full min-h-0">
          {/* Window Header */}
          <div className="bg-slate-900 text-slate-200 px-3.5 py-2.5 flex items-center justify-between gap-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-highlight" />
              <span className="font-bold text-xs tracking-tight text-white">Visual Content</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={clearVisualStyles}
                disabled={!inputHtml.trim()}
                className="text-[11px] font-semibold text-ink bg-paper hover:bg-highlight disabled:opacity-40 disabled:cursor-not-allowed px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                title="Remove all inline styles and classes from the visual content"
              >
                <Eraser className="h-3 w-3" />
                <span>Clear Styles</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] font-semibold text-ink bg-paper hover:bg-highlight px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                title="Upload HTML or Text File"
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
            {WYSIWYG_TOOLS.map((tool, index) => {
              if (tool.divider) {
                return <div key={`div-${index}`} className="h-3.5 w-px bg-slate-300 mx-0.5" />;
              }
              const Icon = tool.icon!;
              const active = tool.block
                ? formatState.block === tool.block
                : Boolean(tool.command && formatState.inline[tool.command]);
              return (
                <button
                  key={tool.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execWysiwygCommand(tool.command!, tool.value, tool.block)}
                  aria-pressed={active}
                  className={`p-1 rounded border cursor-pointer transition-colors ${
                    active
                      ? 'bg-ink border-ink text-paper'
                      : `border-transparent hover:bg-white hover:border-slate-300 ${tool.danger ? 'text-rose-600' : ''}`
                  }`}
                  title={tool.label}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>

          {/* Editable Content Window Area */}
          <div
            className={`flex-1 flex flex-col relative bg-white min-h-0 ${
              dragActive ? 'bg-blue-50/50 ring-2 ring-blue-500 ring-inset' : ''
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <div
              ref={wysiwygRef}
              contentEditable
              onInput={(e) => setInputHtml((e.target as HTMLElement).innerHTML)}
              onPaste={handleVisualPaste}
              onClick={(e) => describeNode(e.target as Node)}
              className="flex-1 p-4 font-sans text-xs text-slate-800 focus:outline-none overflow-y-auto leading-relaxed rich-content min-h-0"
            />
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-3 py-2 flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">Element</span>
            {nodePath.length === 0 ? (
              <span className="text-[11px] text-slate-400 whitespace-nowrap">
                Click any text or element above to inspect its tag
              </span>
            ) : (
              <div className="flex items-center gap-1 whitespace-nowrap">
                {nodePath.map((crumb, index) => {
                  const innermost = index === nodePath.length - 1;
                  return (
                    <React.Fragment key={`${index}-${crumb.tag}`}>
                      {index > 0 && <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />}
                      <code className={`font-mono text-[11px] rounded px-1.5 py-0.5 ${
                        innermost
                          ? 'bg-ink text-paper font-bold'
                          : 'bg-white border border-slate-200 text-slate-500'
                      }`}>
                        &lt;{crumb.tag}&gt;
                      </code>
                    </React.Fragment>
                  );
                })}
                {nodePath[nodePath.length - 1].id && (
                  <code className="font-mono text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                    #{nodePath[nodePath.length - 1].id}
                  </code>
                )}
                {nodePath[nodePath.length - 1].classes.slice(0, 3).map((cls) => (
                  <code key={cls} className="font-mono text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                    .{cls}
                  </code>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* WINDOW 2: HTML CODE EDITOR (Editable Code with HTML / Markdown / Text Views) */}
        <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-2xs overflow-hidden flex flex-col h-[70vh] md:h-full min-h-0 text-slate-100">
          {/* Window Header */}
          <div className="bg-slate-900 px-3.5 py-2.5 flex items-center justify-between gap-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4 text-highlight shrink-0" />
              
              {/* Segmented View Switcher */}
              <div className="flex items-center gap-0.5 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60">
                <button
                  onClick={() => setActiveView('html')}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                    activeView === 'html' ? 'bg-highlight text-ink' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  HTML
                </button>
                <button
                  onClick={() => setActiveView('markdown')}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                    activeView === 'markdown' ? 'bg-highlight text-ink' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Markdown
                </button>
                <button
                  onClick={() => setActiveView('text')}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                    activeView === 'text' ? 'bg-highlight text-ink' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Text
                </button>
              </div>
            </div>

            {/* Action & Formatting Controls */}
            <div className="flex items-center gap-1.5">
              {activeView === 'html' && (
                <div className="hidden sm:flex items-center gap-0.5 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 text-[10px] mr-1">
                  <button
                    onClick={() => setOptions({ ...options, formatting: 'pretty' })}
                    className={`px-1.5 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                      options.formatting === 'pretty' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Format with clean indentation"
                  >
                    Pretty
                  </button>
                  <button
                    onClick={() => setOptions({ ...options, formatting: 'minify' })}
                    className={`px-1.5 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                      options.formatting === 'minify' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Minify HTML"
                  >
                    Minify
                  </button>
                </div>
              )}

              <button
                onClick={() => handleCopy(currentViewContent)}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 flex items-center gap-1 cursor-pointer transition-colors"
                title={`Copy Clean ${activeView.toUpperCase()}`}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={handleDownload}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-highlight text-ink flex items-center gap-1 cursor-pointer transition-colors hover:brightness-95"
                title={`Download Clean ${activeView.toUpperCase()} File`}
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Editable HTML / Markdown / Text Code Area */}
          <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden min-h-0">
            <textarea
              ref={rightTextareaRef}
              value={currentViewContent}
              readOnly={activeView !== 'html'}
              onPaste={handleCodePaste}
              // While typing the pane shows your edit; on leaving it, show the cleaned result.
              onBlur={() => setRightCodeHtml(cleanedResult.html)}
              onChange={(e) => {
                if (activeView === 'html') {
                  handleRightCodeChange(e.target.value);
                }
              }}
              placeholder={`Cleaned ${activeView.toUpperCase()} code will appear here (live editable)...`}
              className="w-full flex-1 p-4 font-mono text-xs text-slate-200 bg-transparent focus:outline-none resize-none leading-relaxed focus:ring-1 focus:ring-highlight/60 min-h-0 overflow-y-auto"
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      {/* PANEL BELOW: CLEANING OPTIONS CHECKBOXES DIV */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
        <div className="bg-ink text-paper px-4 py-2.5 flex items-center justify-between border-b border-ink">
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={isMasterChecked}
              onChange={handleMasterToggle}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-300 cursor-pointer bg-white"
              title="Select / Deselect All Options"
            />
            <span className="font-bold text-sm tracking-wide text-paper">Cleaning options</span>
          </div>
          <div className="text-xs text-paper/80 font-medium">
            {cleanedResult.stats.tagsRemoved + cleanedResult.stats.attrsRemoved} operations performed
          </div>
        </div>

        {/* 20 Checklist Options rendered in a multi-column grid below the windows */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 bg-white">
          {MAIN_CLEANING_OPTIONS.map(({ key, label, icon: Icon }) => {
            const isChecked = options[key as keyof CleanOptions] as boolean;
            return (
              <label
                key={key}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 cursor-pointer select-none transition-all group"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => setOptions({ ...options, [key]: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <Icon className="h-4 w-4 text-slate-500 group-hover:text-blue-600 shrink-0 transition-colors" />
                <span className={`text-xs transition-colors ${isChecked ? 'text-slate-900 font-semibold' : 'text-slate-600 font-medium'}`}>
                  {label}
                </span>
              </label>
            );
          })}
        </div>

        {/* Summary Footer */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span>Toggle options above to customize real-time cleaning rules</span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="hidden sm:inline font-mono text-slate-600">
              {formatBytes(cleanedResult.stats.inputBytes)} → {formatBytes(cleanedResult.stats.outputBytes)}
            </span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="hidden sm:inline text-slate-600 font-mono">
              {cleanedResult.stats.wordCount} words
            </span>
          </div>
          <span className="font-bold font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            {cleanedResult.stats.reductionPct}% smaller
          </span>
        </div>
      </div>
    </div>
  );
}
