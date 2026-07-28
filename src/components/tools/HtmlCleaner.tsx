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

interface CleanOptions {
  // Attribute Sanitizers
  stripAllAttributes: boolean;
  stripInlineStyles: boolean;
  stripClasses: boolean;
  stripIds: boolean;
  stripEventHandlers: boolean;
  stripDataAttrs: boolean;
  stripNonStandardAttrs: boolean;

  // Tag Sanitizers
  stripImages: boolean;
  unwrapLinks: boolean;
  stripLinks: boolean;
  unwrapTables: boolean;
  stripTables: boolean;
  unwrapDivs: boolean;
  stripDivs: boolean;
  unwrapSpans: boolean;
  stripSpans: boolean;
  removeEmptyTags: boolean;
  stripScripts: boolean;
  stripStyles: boolean;
  stripIframes: boolean;
  stripComments: boolean;

  // Typography & Encoding
  convertSemanticTags: boolean;
  fixSmartQuotes: boolean;
  replaceNbsp: boolean;
  collapseWhitespace: boolean;

  // Output & Whitelist
  formatting: 'pretty' | 'minify' | 'raw';
  tagWhitelistMode: boolean;
  allowedTags: string;
}

const DEFAULT_OPTIONS: CleanOptions = {
  stripAllAttributes: false,
  stripInlineStyles: true,
  stripClasses: true,
  stripIds: true,
  stripEventHandlers: true,
  stripDataAttrs: true,
  stripNonStandardAttrs: true,

  stripImages: false,
  unwrapLinks: false,
  stripLinks: false,
  unwrapTables: false,
  stripTables: false,
  unwrapDivs: false,
  stripDivs: false,
  unwrapSpans: false,
  stripSpans: false,
  removeEmptyTags: true,
  stripScripts: true,
  stripStyles: true,
  stripIframes: true,
  stripComments: true,

  convertSemanticTags: true,
  fixSmartQuotes: true,
  replaceNbsp: true,
  collapseWhitespace: false,

  formatting: 'pretty',
  tagWhitelistMode: false,
  allowedTags: 'p, h1, h2, h3, h4, ul, ol, li, strong, em, a, img, blockquote, code, pre, table, tr, td, th, tbody, thead',
};

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
  const [activeTab, setActiveTab] = useState<'code' | 'markdown' | 'preview' | 'text' | 'wysiwyg'>('code');
  const [activeCategory, setActiveCategory] = useState<'all' | 'tags' | 'attrs' | 'security' | 'typography'>('all');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [findText, setFindText] = useState<string>('');
  const [replaceText, setReplaceText] = useState<string>('');
  const [showReplaceBar, setShowReplaceBar] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const wysiwygRef = useRef<HTMLDivElement>(null);

  // Sync WYSIWYG editor content when switching to WYSIWYG tab or when inputHtml changes
  useEffect(() => {
    if (wysiwygRef.current && document.activeElement !== wysiwygRef.current) {
      wysiwygRef.current.innerHTML = inputHtml;
    }
  }, [inputHtml, activeTab]);

  // Clean HTML & Convert to Markdown / Text / Stats
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
          if (options.stripComments) {
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
            if (options.replaceNbsp) {
              val = val.replace(/\u00A0/g, ' ');
            }
            if (options.collapseWhitespace) {
              val = val.replace(/\s+/g, ' ');
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

          // 1. Dangerous or requested complete removals (removes tag and all contents)
          if (
            (options.stripScripts && (tagName === 'SCRIPT' || tagName === 'NOSCRIPT')) ||
            (options.stripStyles && tagName === 'STYLE') ||
            (options.stripIframes && (tagName === 'IFRAME' || tagName === 'EMBED' || tagName === 'OBJECT' || tagName === 'APPLET')) ||
            (options.stripImages && tagName === 'IMG') ||
            (options.stripDivs && tagName === 'DIV') ||
            (options.stripSpans && tagName === 'SPAN') ||
            (options.stripLinks && tagName === 'A') ||
            (options.stripTables && ['TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH'].includes(tagName))
          ) {
            tagsRemoved++;
            return false;
          }

          // 2. Convert deprecated / non-semantic tags
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

          // 3. Clean attributes on this element
          if (options.stripAllAttributes) {
            const attrs = Array.from(el.attributes);
            for (const attr of attrs) {
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
              } else if (options.stripClasses && attrName === 'class') {
                el.removeAttribute(attr.name);
                attrsRemoved++;
              } else if (options.stripIds && attrName === 'id') {
                el.removeAttribute(attr.name);
                attrsRemoved++;
              } else if (options.stripEventHandlers && (attrName.startsWith('on') || attr.value.toLowerCase().trim().startsWith('javascript:'))) {
                el.removeAttribute(attr.name);
                attrsRemoved++;
              } else if (options.stripDataAttrs && attrName.startsWith('data-')) {
                el.removeAttribute(attr.name);
                attrsRemoved++;
              } else if (options.stripNonStandardAttrs && (attrName.startsWith('xmlns') || attrName.startsWith('mso-') || attrName.startsWith('v:') || attrName.startsWith('o:'))) {
                el.removeAttribute(attr.name);
                attrsRemoved++;
              }
            }
          }

          // 4. Clean children first recursively
          const children = Array.from(el.childNodes);
          for (const child of children) {
            const keep = cleanNode(child);
            if (!keep) {
              el.removeChild(child);
            }
          }

          // 5. Tag Whitelist Check (Unwrap non-whitelisted tags)
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

          // 6. Unwrap Specific Tags (preserve inner text / children)
          const shouldUnwrapDiv = options.unwrapDivs && tagName === 'DIV';
          const shouldUnwrapSpan = options.unwrapSpans && tagName === 'SPAN';
          const shouldUnwrapLink = options.unwrapLinks && tagName === 'A';
          const shouldUnwrapTable = options.unwrapTables && ['TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH'].includes(tagName);

          if (shouldUnwrapDiv || shouldUnwrapSpan || shouldUnwrapLink || shouldUnwrapTable) {
            tagsRemoved++;
            const parent = el.parentNode;
            if (parent) {
              while (el.firstChild) {
                parent.insertBefore(el.firstChild, el);
              }
            }
            return false;
          }

          // 7. Remove empty tags (now that children are cleaned)
          const selfClosing = ['IMG', 'BR', 'HR', 'INPUT', 'META', 'LINK', 'SOURCE', 'TRACK'];
          if (
            options.removeEmptyTags &&
            !selfClosing.includes(tagName) &&
            !el.textContent?.trim() &&
            el.children.length === 0
          ) {
            tagsRemoved++;
            return false;
          }

          return true;
        }

        return true;
      };

      const body = doc.body;
      const childNodes = Array.from(body.childNodes);
      for (const child of childNodes) {
        const keep = cleanNode(child);
        if (!keep) {
          body.removeChild(child);
        }
      }

      let rawCleaned = body.innerHTML;

      // Extract plain text
      const plainText = (body.textContent || '').replace(/\n\s*\n/g, '\n\n').trim();

      // Convert HTML to Markdown
      const markdownResult = convertHtmlToMarkdown(body);

      // Formatting HTML Output
      let finalHtml = rawCleaned;
      if (options.formatting === 'pretty') {
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
        markdown: markdownResult,
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

  // HTML to Markdown Converter
  function convertHtmlToMarkdown(element: HTMLElement): string {
    const process = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.nodeValue || '';
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();
        const childrenText = Array.from(el.childNodes).map(process).join('');

        switch (tag) {
          case 'h1':
            return `\n# ${childrenText.trim()}\n\n`;
          case 'h2':
            return `\n## ${childrenText.trim()}\n\n`;
          case 'h3':
            return `\n### ${childrenText.trim()}\n\n`;
          case 'h4':
            return `\n#### ${childrenText.trim()}\n\n`;
          case 'p':
            return `\n${childrenText.trim()}\n\n`;
          case 'strong':
          case 'b':
            return `**${childrenText}**`;
          case 'em':
          case 'i':
            return `*${childrenText}*`;
          case 'code':
            return `\`${childrenText}\``;
          case 'pre':
            return `\n\`\`\`\n${childrenText}\n\`\`\`\n\n`;
          case 'a':
            const href = el.getAttribute('href') || '';
            return href ? `[${childrenText}](${href})` : childrenText;
          case 'img':
            const src = el.getAttribute('src') || '';
            const alt = el.getAttribute('alt') || 'image';
            return `![${alt}](${src})`;
          case 'ul':
          case 'ol':
            return `\n${childrenText}\n`;
          case 'li':
            return `- ${childrenText.trim()}\n`;
          case 'blockquote':
            return `\n> ${childrenText.trim()}\n\n`;
          case 'br':
            return '\n';
          case 'hr':
            return '\n---\n\n';
          default:
            return childrenText;
        }
      }
      return '';
    };

    const md = Array.from(element.childNodes).map(process).join('');
    return md.replace(/\n{3,}/g, '\n\n').trim();
  }

  // Pretty print HTML string
  function formatHtmlString(html: string): string {
    let formatted = '';
    let indent = 0;
    const tab = '  ';

    const cleanStr = html.replace(/>\s+</g, '><').trim();
    const tokens = cleanStr.split(/(<[^>]+>)/g).filter(Boolean);

    const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token.startsWith('</')) {
        indent = Math.max(0, indent - 1);
        formatted += '\n' + tab.repeat(indent) + token;
      } else if (token.startsWith('<') && !token.startsWith('<!--')) {
        const match = token.match(/<([a-zA-Z0-9]+)/);
        const tagName = match ? match[1].toLowerCase() : '';
        const isSelfClosing = token.endsWith('/>') || voidElements.includes(tagName);

        formatted += '\n' + tab.repeat(indent) + token;

        if (!isSelfClosing && !token.startsWith('<!')) {
          indent++;
        }
      } else {
        const text = token.trim();
        if (text) {
          formatted += text;
        }
      }
    }

    return formatted.trim();
  }

  // Copy handler
  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download handler
  const handleDownload = () => {
    let content = cleanedResult.html;
    let extension = 'html';
    let mime = 'text/html';

    if (activeTab === 'markdown') {
      content = cleanedResult.markdown;
      extension = 'md';
      mime = 'text/markdown';
    } else if (activeTab === 'text') {
      content = cleanedResult.text;
      extension = 'txt';
      mime = 'text/plain';
    }

    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cleaned_output.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Drag and drop handler
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.includes('html') || file.type.includes('text') || file.name.endsWith('.html') || file.name.endsWith('.htm')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setInputHtml(event.target.result as string);
          }
        };
        reader.readAsText(file);
      }
    }
  };

  // Presets Configuration matching html-cleaner.com
  const applyPreset = (presetName: 'word' | 'blog' | 'security' | 'markdown' | 'pure' | 'stripAll') => {
    if (presetName === 'word') {
      setOptions({
        ...DEFAULT_OPTIONS,
        stripInlineStyles: true,
        stripClasses: true,
        stripIds: true,
        stripNonStandardAttrs: true,
        removeEmptyTags: true,
        fixSmartQuotes: true,
        replaceNbsp: true,
        convertSemanticTags: true,
      });
    } else if (presetName === 'blog') {
      setOptions({
        ...DEFAULT_OPTIONS,
        stripScripts: true,
        stripStyles: true,
        stripIframes: true,
        stripInlineStyles: true,
        stripClasses: true,
        stripIds: true,
        unwrapDivs: true,
        unwrapSpans: true,
        removeEmptyTags: true,
      });
    } else if (presetName === 'security') {
      setOptions({
        ...DEFAULT_OPTIONS,
        stripScripts: true,
        stripStyles: true,
        stripIframes: true,
        stripEventHandlers: true,
        stripDataAttrs: true,
        stripComments: true,
      });
    } else if (presetName === 'markdown') {
      setOptions({
        ...DEFAULT_OPTIONS,
        stripInlineStyles: true,
        stripClasses: true,
        removeEmptyTags: true,
        convertSemanticTags: true,
      });
      setActiveTab('markdown');
    } else if (presetName === 'pure') {
      setOptions({
        ...DEFAULT_OPTIONS,
        tagWhitelistMode: true,
        stripInlineStyles: true,
        stripClasses: true,
        stripIds: true,
      });
    } else if (presetName === 'stripAll') {
      setOptions({
        ...DEFAULT_OPTIONS,
        stripAllAttributes: true,
        unwrapDivs: true,
        unwrapSpans: true,
        removeEmptyTags: true,
        stripComments: true,
      });
    }
  };

  // WYSIWYG ExecCommand helper
  const execWysiwygCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (wysiwygRef.current) {
      setInputHtml(wysiwygRef.current.innerHTML);
    }
  };

  // Sanitizer Checkboxes Configuration
  const SANITIZER_TOGGLES: { key: keyof CleanOptions; label: string; category: 'attrs' | 'tags' | 'security' | 'typography'; description: string }[] = [
    // Attributes
    { key: 'stripInlineStyles', label: 'Strip inline styles (style="...")', category: 'attrs', description: 'Removes inline CSS rules' },
    { key: 'stripClasses', label: 'Strip class attributes (class="...")', category: 'attrs', description: 'Removes CSS class names' },
    { key: 'stripIds', label: 'Strip ID attributes (id="...")', category: 'attrs', description: 'Removes unique element IDs' },
    { key: 'stripAllAttributes', label: 'Strip ALL attributes from all tags', category: 'attrs', description: 'Leaves clean naked HTML tags' },
    { key: 'stripDataAttrs', label: 'Strip custom data-* attributes', category: 'attrs', description: 'Removes frontend data bindings' },
    { key: 'stripNonStandardAttrs', label: 'Strip Word/Office namespaces (mso-*, o:*)', category: 'attrs', description: 'Eliminates Microsoft Office junk markup' },

    // Tags & Structure
    { key: 'unwrapDivs', label: 'Unwrap <div> tags (keep inner text/content)', category: 'tags', description: 'Removes div tags without losing text' },
    { key: 'stripDivs', label: 'Remove <div> tags & contents completely', category: 'tags', description: 'Deletes divs and all inner elements' },
    { key: 'unwrapSpans', label: 'Unwrap <span> tags (keep inner text)', category: 'tags', description: 'Removes inline spans without losing text' },
    { key: 'stripSpans', label: 'Remove <span> tags & contents completely', category: 'tags', description: 'Deletes spans and inner text' },
    { key: 'unwrapLinks', label: 'Unwrap <a> links (keep anchor text)', category: 'tags', description: 'Turns hyperlinks into plain text' },
    { key: 'stripLinks', label: 'Remove <a> links & link text completely', category: 'tags', description: 'Deletes hyperlinks and text' },
    { key: 'unwrapTables', label: 'Unwrap <table> structure (keep cell text)', category: 'tags', description: 'Converts tables to plain text blocks' },
    { key: 'stripTables', label: 'Remove <table> structure & cell text completely', category: 'tags', description: 'Deletes tables entirely' },
    { key: 'stripImages', label: 'Remove <img> image tags completely', category: 'tags', description: 'Strips image elements' },
    { key: 'removeEmptyTags', label: 'Remove empty tags (<p></p>, <div></div>)', category: 'tags', description: 'Cleans empty line breaks and tags' },

    // Security & Scripts
    { key: 'stripScripts', label: 'Strip <script> & <noscript> blocks', category: 'security', description: 'Blocks malicious JavaScript' },
    { key: 'stripStyles', label: 'Strip <style> embedded CSS blocks', category: 'security', description: 'Removes global style tags' },
    { key: 'stripIframes', label: 'Strip <iframe> and embed elements', category: 'security', description: 'Blocks embedded frame widgets' },
    { key: 'stripEventHandlers', label: 'Strip JS event handlers (onclick, javascript:)', category: 'security', description: 'Prevents XSS attacks' },
    { key: 'stripComments', label: 'Strip HTML comments (<!-- -->)', category: 'security', description: 'Cleans developer comments' },

    // Typography & Formatting
    { key: 'convertSemanticTags', label: 'Convert <b> & <i> to <strong> & <em>', category: 'typography', description: 'Standardizes HTML5 semantic tags' },
    { key: 'fixSmartQuotes', label: 'Normalize smart quotes (“ ” ‘ ’ -> " \')', category: 'typography', description: 'Fixes Word curly quotes' },
    { key: 'replaceNbsp', label: 'Replace &nbsp; with regular spaces', category: 'typography', description: 'Cleans non-breaking spaces' },
    { key: 'collapseWhitespace', label: 'Collapse extra consecutive spaces', category: 'typography', description: 'Trims duplicate spaces' },
  ];

  const filteredToggles = SANITIZER_TOGGLES.filter(
    (item) => activeCategory === 'all' || item.category === activeCategory
  );

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/80">
            <Sparkles className="h-3.5 w-3.5 text-sky-600" />
            <span>HTML Cleaner.com Equivalent Sanitizer Engine</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            HTML Cleaner & Sanitizer Studio
          </h2>
          <p className="text-xs text-slate-500 max-w-xl">
            Clean Microsoft Word bloat, strip tracking scripts & inline styles, convert HTML to Markdown, or sanitize security hazards with full html-cleaner.com parity.
          </p>
        </div>

        {/* Quick Sample Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setInputHtml(SAMPLE_HTML_WORD_DOC)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 cursor-pointer transition-colors flex items-center gap-1.5"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-sky-600" />
            <span>Word Sample</span>
          </button>
          <button
            onClick={() => setInputHtml(SAMPLE_HTML_SCRAPED)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 cursor-pointer transition-colors flex items-center gap-1.5"
          >
            <Globe className="h-3.5 w-3.5 text-indigo-600" />
            <span>Scraped Web Sample</span>
          </button>
          <button
            onClick={() => { setInputHtml(''); setFindText(''); setReplaceText(''); }}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            title="Clear input editor"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sanitizer Options Panel (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <SlidersHorizontal className="h-4 w-4 text-sky-600" />
                <span>Sanitizer Rules</span>
              </div>
              <button
                onClick={() => setOptions(DEFAULT_OPTIONS)}
                className="text-[11px] font-semibold text-slate-400 hover:text-sky-600 cursor-pointer transition-colors flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Reset Defaults</span>
              </button>
            </div>

            {/* Quick Presets Grid matching html-cleaner.com */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Quick One-Click Presets
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => applyPreset('word')}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 text-slate-700 transition-colors text-left flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-sky-600" />
                  <span>Strip Word Bloat</span>
                </button>
                <button
                  onClick={() => applyPreset('blog')}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 text-slate-700 transition-colors text-left flex items-center gap-1.5"
                >
                  <Globe className="h-3.5 w-3.5 text-indigo-600" />
                  <span>CMS / Blog Safe</span>
                </button>
                <button
                  onClick={() => applyPreset('stripAll')}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 text-slate-700 transition-colors text-left flex items-center gap-1.5"
                >
                  <Eraser className="h-3.5 w-3.5 text-rose-600" />
                  <span>Strip All Attrs</span>
                </button>
                <button
                  onClick={() => applyPreset('security')}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 text-slate-700 transition-colors text-left flex items-center gap-1.5"
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                  <span>XSS Security</span>
                </button>
                <button
                  onClick={() => applyPreset('pure')}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 text-slate-700 transition-colors text-left flex items-center gap-1.5"
                >
                  <ListFilter className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Tag Whitelist</span>
                </button>
                <button
                  onClick={() => applyPreset('markdown')}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 text-slate-700 transition-colors text-left flex items-center gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5 text-fuchsia-600" />
                  <span>To Markdown</span>
                </button>
              </div>
            </div>

            {/* Find and Replace Bar Toggle */}
            <div className="pt-1">
              <button
                onClick={() => setShowReplaceBar(!showReplaceBar)}
                className="w-full py-1.5 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Replace className="h-3.5 w-3.5 text-slate-500" />
                  <span>Find & Replace Utility</span>
                </div>
                <span className="text-[10px] text-slate-400">{showReplaceBar ? 'Hide' : 'Show'}</span>
              </button>

              <AnimatePresence>
                {showReplaceBar && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2 mt-2 pt-2 border-t border-slate-100 overflow-hidden"
                  >
                    <input
                      type="text"
                      placeholder="Find (text or regex)..."
                      value={findText}
                      onChange={(e) => setFindText(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <input
                      type="text"
                      placeholder="Replace with..."
                      value={replaceText}
                      onChange={(e) => setReplaceText(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sanitizer Category Filter Tabs */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Sanitizer Toggles
                </label>
                <span className="text-[10px] font-mono text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                  {filteredToggles.length} Active Rules
                </span>
              </div>

              <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'attrs', label: 'Attributes' },
                  { id: 'tags', label: 'Tags' },
                  { id: 'security', label: 'Security' },
                  { id: 'typography', label: 'Text' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id as any)}
                    className={`px-2 py-1 text-[11px] font-semibold rounded-lg capitalize transition-all cursor-pointer ${
                      activeCategory === cat.id
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Toggles List */}
              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {filteredToggles.map(({ key, label, description }) => (
                  <label
                    key={key}
                    className="flex items-start gap-2.5 text-xs font-medium text-slate-700 hover:text-slate-950 cursor-pointer select-none group"
                  >
                    <input
                      type="checkbox"
                      checked={options[key] as boolean}
                      onChange={(e) => setOptions({ ...options, [key]: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer mt-0.5"
                    />
                    <div>
                      <span className="block leading-tight font-semibold text-slate-800 group-hover:text-sky-700 transition-colors">
                        {label}
                      </span>
                      <span className="text-[10px] text-slate-400 block leading-tight">
                        {description}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Whitelist Settings */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider select-none cursor-pointer">
                <span>Tag Whitelist Filter</span>
                <input
                  type="checkbox"
                  checked={options.tagWhitelistMode}
                  onChange={(e) => setOptions({ ...options, tagWhitelistMode: e.target.checked })}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 cursor-pointer"
                />
              </label>

              {options.tagWhitelistMode && (
                <textarea
                  rows={2}
                  value={options.allowedTags}
                  onChange={(e) => setOptions({ ...options, allowedTags: e.target.value })}
                  placeholder="Comma separated allowed tags: p, h1, a, img, ul, li..."
                  className="w-full p-2 text-xs font-mono rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              )}
            </div>

            {/* Code Formatting */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Code Indentation & Formatting
              </label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
                {(['pretty', 'raw', 'minify'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setOptions({ ...options, formatting: fmt })}
                    className={`py-1 text-xs font-semibold rounded-lg capitalize transition-all cursor-pointer ${
                      options.formatting === fmt
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Input / Output Workspace (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Live Performance & Compression Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Original Size
              </span>
              <span className="text-sm font-bold font-mono text-slate-800">
                {(cleanedResult.stats.inputBytes / 1024).toFixed(2)} KB
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Cleaned Size
              </span>
              <span className="text-sm font-bold font-mono text-emerald-600">
                {(cleanedResult.stats.outputBytes / 1024).toFixed(2)} KB
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Size Saved
              </span>
              <span className="text-sm font-bold font-mono text-sky-600">
                {cleanedResult.stats.reductionPct}% lighter
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Clean Words / Stripped
              </span>
              <span className="text-sm font-bold font-mono text-amber-600">
                {cleanedResult.stats.wordCount} words ({cleanedResult.stats.tagsRemoved + cleanedResult.stats.attrsRemoved} ops)
              </span>
            </div>
          </div>

          {/* Main Editor Console */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col min-h-[550px]">
            {/* View Tab Selector Bar */}
            <div className="bg-slate-900 text-slate-200 px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
              <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-lg overflow-x-auto max-w-full no-scrollbar">
                <button
                  onClick={() => setActiveTab('code')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'code' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Code className="h-3.5 w-3.5" />
                  <span>Cleaned HTML</span>
                </button>
                <button
                  onClick={() => setActiveTab('wysiwyg')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'wysiwyg' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5 text-amber-300" />
                  <span>Visual Editor (WYSIWYG)</span>
                </button>
                <button
                  onClick={() => setActiveTab('markdown')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'markdown' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 text-emerald-300" />
                  <span>To Markdown</span>
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'preview' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Sandboxed Preview</span>
                </button>
                <button
                  onClick={() => setActiveTab('text')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'text' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Plain Text</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    let textToCopy = cleanedResult.html;
                    if (activeTab === 'markdown') textToCopy = cleanedResult.markdown;
                    if (activeTab === 'text') textToCopy = cleanedResult.text;
                    handleCopy(textToCopy);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy View'}</span>
                </button>

                <button
                  onClick={handleDownload}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export .{activeTab === 'markdown' ? 'md' : activeTab === 'text' ? 'txt' : 'html'}</span>
                </button>
              </div>
            </div>

            {/* Workspace Split Panes */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              {/* Left Pane: Raw Input HTML or WYSIWYG Editor */}
              <div
                className={`flex flex-col relative bg-slate-50 ${dragActive ? 'bg-sky-50/50 ring-2 ring-sky-500 ring-inset' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
              >
                {activeTab === 'wysiwyg' ? (
                  <div className="flex flex-col h-full bg-white">
                    {/* WYSIWYG Editor Formatting Toolbar */}
                    <div className="p-2 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center gap-1">
                      <button
                        onClick={() => execWysiwygCommand('bold')}
                        className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-300 text-slate-700 cursor-pointer"
                        title="Bold"
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => execWysiwygCommand('italic')}
                        className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-300 text-slate-700 cursor-pointer"
                        title="Italic"
                      >
                        <Italic className="h-3.5 w-3.5" />
                      </button>
                      <div className="h-4 w-px bg-slate-300 mx-1" />
                      <button
                        onClick={() => execWysiwygCommand('formatBlock', '<h1>')}
                        className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-300 text-slate-700 cursor-pointer"
                        title="Heading 1"
                      >
                        <Heading1 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => execWysiwygCommand('formatBlock', '<h2>')}
                        className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-300 text-slate-700 cursor-pointer"
                        title="Heading 2"
                      >
                        <Heading2 className="h-3.5 w-3.5" />
                      </button>
                      <div className="h-4 w-px bg-slate-300 mx-1" />
                      <button
                        onClick={() => execWysiwygCommand('insertUnorderedList')}
                        className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-300 text-slate-700 cursor-pointer"
                        title="Bullet List"
                      >
                        <List className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => execWysiwygCommand('insertOrderedList')}
                        className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-300 text-slate-700 cursor-pointer"
                        title="Numbered List"
                      >
                        <ListOrdered className="h-3.5 w-3.5" />
                      </button>
                      <div className="h-4 w-px bg-slate-300 mx-1" />
                      <button
                        onClick={() => execWysiwygCommand('removeFormat')}
                        className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-300 text-slate-700 cursor-pointer"
                        title="Clear Formatting"
                      >
                        <Eraser className="h-3.5 w-3.5 text-rose-600" />
                      </button>
                    </div>

                    <div
                      ref={wysiwygRef}
                      contentEditable
                      onInput={(e) => setInputHtml((e.target as HTMLElement).innerHTML)}
                      className="flex-1 p-4 font-sans text-xs text-slate-800 bg-white focus:outline-none overflow-y-auto leading-relaxed min-h-[350px] prose prose-slate max-w-none"
                    />
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-2 bg-slate-100/90 border-b border-slate-200 text-xs font-semibold text-slate-600 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCode className="h-3.5 w-3.5 text-slate-500" />
                        <span>Raw Input HTML / Scraped Source</span>
                      </div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[11px] font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Upload className="h-3 w-3" />
                        <span>Upload File</span>
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

                    <textarea
                      value={inputHtml}
                      onChange={(e) => setInputHtml(e.target.value)}
                      placeholder="Paste raw/dirty HTML here or drag & drop files..."
                      className="w-full flex-1 p-4 font-mono text-xs text-slate-800 bg-transparent focus:outline-none resize-none leading-relaxed"
                      spellCheck={false}
                    />
                  </>
                )}
              </div>

              {/* Right Pane: Processed Clean View */}
              <div className="flex flex-col bg-slate-950 text-slate-100 min-h-[380px]">
                {activeTab === 'code' && (
                  <div className="flex flex-col h-full">
                    <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-semibold text-slate-400 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Cleaned Output Markup</span>
                      </div>
                      <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                        Sanitized & Formatted
                      </span>
                    </div>

                    <textarea
                      readOnly
                      value={cleanedResult.html}
                      className="w-full flex-1 p-4 font-mono text-xs text-slate-200 bg-transparent focus:outline-none resize-none leading-relaxed selection:bg-sky-600"
                      spellCheck={false}
                    />
                  </div>
                )}

                {activeTab === 'wysiwyg' && (
                  <div className="flex flex-col h-full">
                    <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-semibold text-slate-400 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Cleaned HTML Source Code</span>
                      </div>
                      <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                        Real-Time Sync
                      </span>
                    </div>

                    <textarea
                      readOnly
                      value={cleanedResult.html}
                      className="w-full flex-1 p-4 font-mono text-xs text-slate-200 bg-transparent focus:outline-none resize-none leading-relaxed selection:bg-sky-600"
                      spellCheck={false}
                    />
                  </div>
                )}

                {activeTab === 'markdown' && (
                  <div className="flex flex-col h-full">
                    <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-semibold text-slate-400 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Converted Markdown Source</span>
                      </div>
                      <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                        HTML5 to MD
                      </span>
                    </div>

                    <textarea
                      readOnly
                      value={cleanedResult.markdown}
                      className="w-full flex-1 p-4 font-mono text-xs text-emerald-300 bg-transparent focus:outline-none resize-none leading-relaxed selection:bg-sky-600"
                      spellCheck={false}
                    />
                  </div>
                )}

                {activeTab === 'preview' && (
                  <div className="flex flex-col h-full bg-white text-slate-900 p-4 overflow-y-auto">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg mb-3 text-xs text-slate-500 flex items-center gap-2">
                      <Info className="h-4 w-4 text-sky-600 shrink-0" />
                      <span>Sandboxed visual rendering of the cleaned HTML markup.</span>
                    </div>

                    <div
                      className="prose prose-slate max-w-none text-sm p-4 border border-slate-200 rounded-xl bg-white shadow-2xs min-h-[320px]"
                      dangerouslySetInnerHTML={{ __html: cleanedResult.html }}
                    />
                  </div>
                )}

                {activeTab === 'text' && (
                  <div className="flex flex-col h-full">
                    <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-semibold text-slate-400 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-slate-400" />
                        <span>Extracted Plain Text Content</span>
                      </div>
                    </div>

                    <textarea
                      readOnly
                      value={cleanedResult.text}
                      className="w-full flex-1 p-4 font-mono text-xs text-slate-200 bg-transparent focus:outline-none resize-none leading-relaxed"
                      spellCheck={false}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
