# Graph Report - Dev-Utility-tool  (2026-09-23)

## Corpus Check
- 22 files · ~46,633 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 2, .example 1, .lock 1)

## Summary
- 262 nodes · 400 edges · 17 communities (16 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a338c1e0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- server.ts
- ContentChecker.tsx
- package.json
- App.tsx
- Responsive Device Preview Tool
- utils.ts
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
- Git & Conventional Commits Rules

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `copyText()` - 13 edges
3. `react` - 12 edges
4. `lucide-react` - 11 edges
5. `scripts` - 8 edges
6. `stripTags()` - 8 edges
7. `parseHtml()` - 8 edges
8. `buildLocalReport()` - 8 edges
9. `GradientGenerator()` - 8 edges
10. `motion` - 6 edges

## Surprising Connections (you probably didn't know these)
- `GradientGenerator()` --calls--> `copyText()`  [EXTRACTED]
  src/components/tools/GradientGenerator.tsx → src/lib/utils.ts
- `ImageConverter()` --calls--> `copyText()`  [EXTRACTED]
  src/components/tools/ImageConverter.tsx → src/lib/utils.ts
- `ResponsivePreview()` --calls--> `copyText()`  [EXTRACTED]
  src/components/tools/ResponsivePreview.tsx → src/lib/utils.ts
- `clientParseSeoAndSchemas()` --calls--> `sanitizeAndParseJsonLd()`  [EXTRACTED]
  src/components/tools/SeoChecker.tsx → src/lib/utils.ts
- `SeoChecker()` --calls--> `copyText()`  [EXTRACTED]
  src/components/tools/SeoChecker.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Client Application Bootstrap Lifecycle** — index, index_hmr_suppression, index_initial_loader, index_entry_script [EXTRACTED 1.00]
- **Dev Utility Tool Brand Identity Composition** — public_favicon_app_icon, public_favicon_wrench_mark, public_favicon_sparkle_accent [EXTRACTED 1.00]

## Communities (17 total, 1 thin omitted)

### Community 0 - "server.ts"
Cohesion: 0.10
Nodes (32): express, app, buildLocalReport(), buildPreviewErrorPage(), buildPreviewProbe(), decodeHtmlEntities(), escapeHtmlAttribute(), extractAllHeadings() (+24 more)

### Community 1 - "ContentChecker.tsx"
Cohesion: 0.18
Nodes (12): AnalysisReport, BodyContentSection, BodyMismatch, categoryGroup(), CHECK_CATEGORIES, ContentChecker(), FaqSchemaSection, FeatureImageSection (+4 more)

### Community 2 - "package.json"
Cohesion: 0.09
Nodes (22): name, private, type, version, autoprefixer, compression, dotenv, esbuild (+14 more)

### Community 3 - "App.tsx"
Cohesion: 0.11
Nodes (25): lucide-react, motion, react, react-dom, App(), ContentChecker, GradientGenerator, HtmlCleaner (+17 more)

### Community 4 - "Responsive Device Preview Tool"
Cohesion: 0.14
Nodes (19): Brand, BRAND_LABEL, BRANDS_BY_GROUP, chromeMetrics(), Device, DEVICE_LIBRARY, DeviceShell(), displayUrl() (+11 more)

### Community 5 - "utils.ts"
Cohesion: 0.08
Nodes (33): clsx, jszip, ref_node_assert, tailwind-merge, CleanOptions, DEFAULT_OPTIONS, formatBytes(), HtmlCleaner() (+25 more)

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

### Community 16 - "Git & Conventional Commits Rules"
Cohesion: 0.29
Nodes (6): Commit Message Format, Commit Types, Examples, Git & Conventional Commits Rules, Pre-Commit Checklist, When to Commit

## Knowledge Gaps
- **133 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+128 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 143 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `App.tsx` to `ContentChecker.tsx`, `package.json`, `Responsive Device Preview Tool`, `utils.ts`, `Gradient Generator & Color Tools`?**
  _High betweenness centrality (0.139) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `App.tsx` to `ContentChecker.tsx`, `package.json`, `Responsive Device Preview Tool`, `utils.ts`, `Gradient Generator & Color Tools`?**
  _High betweenness centrality (0.132) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Runtime Dependencies Graph` to `package.json`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _133 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09815078236130868 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09057971014492754 - nodes in this community are weakly interconnected._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10804597701149425 - nodes in this community are weakly interconnected._