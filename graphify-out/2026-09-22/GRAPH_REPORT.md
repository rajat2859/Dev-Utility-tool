# Graph Report - Dev-Utility-tool  (2026-09-22)

## Corpus Check
- 22 files · ~42,460 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 2, .example 1, .lock 1)

## Summary
- 258 nodes · 406 edges · 16 communities (15 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `362c9d8a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Express Server & Web Scraping
- HTML Cleaner & Packaging Tool
- Project Build & Config Manifest
- Application UI Shell & Routing
- Responsive Device Preview Tool
- Content Checker & SEO Analyzer
- Gradient Generator & Color Tools
- TypeScript Compiler Configuration
- Runtime Dependencies Graph
- Development Dependencies
- NPM Project Scripts
- Graphify Agent Rules & Workflows
- HTML Entrypoint & Bootstrap
- Core Type Definitions
- Apple Touch & PWA Branding
- Favicon & Visual Identity

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `copyText()` - 15 edges
3. `react` - 13 edges
4. `lucide-react` - 11 edges
5. `scripts` - 8 edges
6. `stripTags()` - 8 edges
7. `parseHtml()` - 8 edges
8. `buildLocalReport()` - 8 edges
9. `ToolHeader()` - 8 edges
10. `GradientGenerator()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `GradientGenerator()` --calls--> `copyText()`  [EXTRACTED]
  src/components/tools/GradientGenerator.tsx → src/lib/utils.ts
- `HtmlCleaner()` --calls--> `copyText()`  [EXTRACTED]
  src/components/tools/HtmlCleaner.tsx → src/lib/utils.ts
- `ImageConverter()` --calls--> `copyText()`  [EXTRACTED]
  src/components/tools/ImageConverter.tsx → src/lib/utils.ts
- `ResponsivePreview()` --calls--> `copyText()`  [EXTRACTED]
  src/components/tools/ResponsivePreview.tsx → src/lib/utils.ts
- `DashboardGrid()` --calls--> `prefetchTool()`  [EXTRACTED]
  src/components/DashboardGrid.tsx → src/App.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Client Application Bootstrap Lifecycle** — index, index_hmr_suppression, index_initial_loader, index_entry_script [EXTRACTED 1.00]
- **Dev Utility Tool Brand Identity Composition** — public_favicon_app_icon, public_favicon_wrench_mark, public_favicon_sparkle_accent [EXTRACTED 1.00]

## Communities (16 total, 1 thin omitted)

### Community 0 - "Express Server & Web Scraping"
Cohesion: 0.09
Nodes (32): compression, tesseract.js, app, buildLocalReport(), buildPreviewErrorPage(), buildPreviewProbe(), decodeHtmlEntities(), escapeHtmlAttribute() (+24 more)

### Community 1 - "HTML Cleaner & Packaging Tool"
Cohesion: 0.08
Nodes (34): jszip, ref_node_assert, ToolHeader(), ToolHeaderProps, AnalysisReport, BodyContentSection, BodyMismatch, categoryGroup() (+26 more)

### Community 2 - "Project Build & Config Manifest"
Cohesion: 0.09
Nodes (23): name, private, type, version, autoprefixer, clsx, dotenv, esbuild (+15 more)

### Community 3 - "Application UI Shell & Routing"
Cohesion: 0.11
Nodes (24): lucide-react, motion, react, react-dom, App(), ContentChecker, GradientGenerator, HtmlCleaner (+16 more)

### Community 4 - "Responsive Device Preview Tool"
Cohesion: 0.14
Nodes (19): Brand, BRAND_LABEL, BRANDS_BY_GROUP, chromeMetrics(), Device, DEVICE_LIBRARY, DeviceShell(), displayUrl() (+11 more)

### Community 5 - "Content Checker & SEO Analyzer"
Cohesion: 0.20
Nodes (13): CleanOptions, DEFAULT_OPTIONS, formatBytes(), HtmlCleaner(), htmlToMarkdown(), INLINE_STATE_COMMANDS, MAIN_CLEANING_OPTIONS, NodeCrumb (+5 more)

### Community 6 - "Gradient Generator & Color Tools"
Cohesion: 0.18
Nodes (18): averageHexColors(), ColorStop, computeAverageColor(), contrastRating(), getContrastRatio(), getRelativeLuminance(), GradientGenerator(), hexToRgbTuple() (+10 more)

### Community 7 - "TypeScript Compiler Configuration"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules, jsx, lib, module (+8 more)

### Community 8 - "Runtime Dependencies Graph"
Cohesion: 0.14
Nodes (14): dependencies, clsx, compression, dotenv, express, jszip, lucide-react, motion (+6 more)

### Community 9 - "Development Dependencies"
Cohesion: 0.15
Nodes (13): devDependencies, autoprefixer, esbuild, tailwindcss, tsx, @types/compression, @types/express, @types/jszip (+5 more)

### Community 10 - "NPM Project Scripts"
Cohesion: 0.25
Nodes (8): scripts, build, clean, dev, lint, preview, start, test

### Community 12 - "HTML Entrypoint & Bootstrap"
Cohesion: 0.60
Nodes (4): Main Application Entry Script, Vite HMR WebSocket Suppression, ImageTracerJS CDN Script, App Initial Loader UI

### Community 13 - "Core Type Definitions"
Cohesion: 0.40
Nodes (4): AppSettings, Tool, ToolCategory, ToolUsage

### Community 14 - "Apple Touch & PWA Branding"
Cohesion: 1.00
Nodes (3): Apple Touch Icon, iOS Home Screen & PWA Icon, Wrench Tool Visual Symbol

### Community 15 - "Favicon & Visual Identity"
Cohesion: 1.00
Nodes (3): Dev Utility Tool Favicon, AI Sparkle Accent, Developer Utility Wrench Mark

## Knowledge Gaps
- **133 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+128 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 142 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Application UI Shell & Routing` to `HTML Cleaner & Packaging Tool`, `Project Build & Config Manifest`, `Responsive Device Preview Tool`, `Content Checker & SEO Analyzer`, `Gradient Generator & Color Tools`?**
  _High betweenness centrality (0.152) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `Application UI Shell & Routing` to `HTML Cleaner & Packaging Tool`, `Project Build & Config Manifest`, `Responsive Device Preview Tool`, `Content Checker & SEO Analyzer`, `Gradient Generator & Color Tools`?**
  _High betweenness centrality (0.138) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Runtime Dependencies Graph` to `Project Build & Config Manifest`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _133 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Express Server & Web Scraping` be split into smaller, more focused modules?**
  _Cohesion score 0.09388335704125178 - nodes in this community are weakly interconnected._
- **Should `HTML Cleaner & Packaging Tool` be split into smaller, more focused modules?**
  _Cohesion score 0.08013937282229965 - nodes in this community are weakly interconnected._
- **Should `Project Build & Config Manifest` be split into smaller, more focused modules?**
  _Cohesion score 0.08666666666666667 - nodes in this community are weakly interconnected._