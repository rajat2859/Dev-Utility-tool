# Graph Report - Dev-Utility-tool  (2026-09-29)

## Corpus Check
- 55 files · ~66,719 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 2, .example 1, .lock 1)

## Summary
- 417 nodes · 815 edges · 21 communities (18 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9a77c088`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- server.ts
- ContentChecker.tsx
- package.json
- AuditReportBuilder.ts
- Responsive Device Preview Tool
- App.tsx
- Gradient Generator & Color Tools
- compilerOptions
- dependencies
- Development Dependencies
- contentAuditRoutes.ts
- Graphify Agent Rules & Workflows
- HTML Entrypoint & Bootstrap
- Core Type Definitions
- Apple Touch & PWA Branding
- Favicon & Visual Identity
- Git & Conventional Commits Rules
- normalizeText
- PageFetcher.ts
- ref_fs
- ref_google_auth_library

## God Nodes (most connected - your core abstractions)
1. `compareTextSimilarity()` - 19 edges
2. `compilerOptions` - 16 edges
3. `normalizeText()` - 14 edges
4. `react` - 13 edges
5. `copyText()` - 13 edges
6. `lucide-react` - 12 edges
7. `buildContentAuditReport()` - 11 edges
8. `normalizeText()` - 10 edges
9. `parseGoogleDoc()` - 9 edges
10. `scripts` - 8 edges

## Surprising Connections (you probably didn't know these)
- `MatchScoreResult` --references--> `BlockComparisonStatus`  [EXTRACTED]
  server/content-auditor/comparison/TextMatcher.ts → server/content-auditor/types/report.ts
- `compareTextSimilarity()` --calls--> `canonicalize()`  [EXTRACTED]
  server/content-auditor/comparison/TextMatcher.ts → server/content-auditor/reference/ReferenceNormalizer.ts
- `compareTextSimilarity()` --calls--> `normalizeText()`  [EXTRACTED]
  server/content-auditor/comparison/TextMatcher.ts → server/content-auditor/reference/ReferenceNormalizer.ts
- `compareTextSimilarity()` --calls--> `tokenizeWords()`  [EXTRACTED]
  server/content-auditor/comparison/TextMatcher.ts → server/content-auditor/reference/ReferenceNormalizer.ts
- `ContentChecker()` --calls--> `normalizeUrl()`  [EXTRACTED]
  src/components/tools/ContentChecker.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Client Application Bootstrap Lifecycle** — index, index_hmr_suppression, index_initial_loader, index_entry_script [EXTRACTED 1.00]
- **Dev Utility Tool Brand Identity Composition** — public_favicon_app_icon, public_favicon_wrench_mark, public_favicon_sparkle_accent [EXTRACTED 1.00]

## Communities (21 total, 3 thin omitted)

### Community 0 - "server.ts"
Cohesion: 0.12
Nodes (20): compression, dotenv, app, buildPreviewErrorPage(), buildPreviewProbe(), decodeHtmlEntities(), escapeHtmlAttribute(), extractAllHeadings() (+12 more)

### Community 1 - "ContentChecker.tsx"
Cohesion: 0.13
Nodes (17): AnalysisReport, AuditIssue, BodyContentSection, BodyMismatch, categoryGroup(), CHECK_CATEGORIES, ContentChecker(), DiffWord (+9 more)

### Community 2 - "package.json"
Cohesion: 0.07
Nodes (29): name, private, scripts, build, clean, dev, lint, preview (+21 more)

### Community 3 - "AuditReportBuilder.ts"
Cohesion: 0.12
Nodes (40): computeWordDiff(), auditFaq(), auditHeadings(), auditFeatureImage(), extractFilename(), normalizeImageUrl(), auditLists(), auditContentSequence() (+32 more)

### Community 4 - "Responsive Device Preview Tool"
Cohesion: 0.14
Nodes (19): Brand, BRAND_LABEL, BRANDS_BY_GROUP, chromeMetrics(), Device, DEVICE_LIBRARY, DeviceShell(), displayUrl() (+11 more)

### Community 5 - "App.tsx"
Cohesion: 0.05
Nodes (57): jszip, lucide-react, motion, ref_node_assert, react, react-dom, App(), ContentChecker (+49 more)

### Community 6 - "Gradient Generator & Color Tools"
Cohesion: 0.18
Nodes (18): averageHexColors(), ColorStop, computeAverageColor(), contrastRating(), getContrastRatio(), getRelativeLuminance(), GradientGenerator(), hexToRgbTuple() (+10 more)

### Community 7 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules, jsx, lib, module (+9 more)

### Community 8 - "dependencies"
Cohesion: 0.11
Nodes (18): dependencies, cheerio, clsx, compression, dotenv, express, googleapis, jszip (+10 more)

### Community 9 - "Development Dependencies"
Cohesion: 0.15
Nodes (13): devDependencies, autoprefixer, esbuild, tailwindcss, tsx, @types/compression, @types/express, @types/jszip (+5 more)

### Community 10 - "contentAuditRoutes.ts"
Cohesion: 0.10
Nodes (39): express, googleapis, ref_node_test, zod, compareListDetails(), compareNormalizedTrees(), compareTableDetails(), isTextMatch() (+31 more)

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

### Community 17 - "normalizeText"
Cohesion: 0.09
Nodes (30): cheerio, ref_domhandler, tesseract.js, extractLabeledField(), parseGoogleDocReference(), canonicalize(), decodeHtmlEntities(), HTML_ENTITIES (+22 more)

### Community 18 - "PageFetcher.ts"
Cohesion: 0.21
Nodes (12): ref_node_dns, ref_node_fs, playwright-core, BROWSER_HEADERS, FetchResult, fetchWebpage(), CANDIDATE_BROWSER_PATHS, findBrowserPath() (+4 more)

## Knowledge Gaps
- **164 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+159 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 180 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `react` connect `App.tsx` to `ContentChecker.tsx`, `package.json`, `Responsive Device Preview Tool`, `Gradient Generator & Color Tools`, `contentAuditRoutes.ts`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `App.tsx` to `ContentChecker.tsx`, `package.json`, `Responsive Device Preview Tool`, `Gradient Generator & Color Tools`, `contentAuditRoutes.ts`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _164 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12307692307692308 - nodes in this community are weakly interconnected._
- **Should `ContentChecker.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13071895424836602 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06881720430107527 - nodes in this community are weakly interconnected._