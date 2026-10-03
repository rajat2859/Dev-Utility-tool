export type PageBlockType = 'heading' | 'paragraph' | 'listItem' | 'tableRow' | 'tableCell';

export interface PageHeading {
  id: string;
  level: number; // 1..6
  text: string;
  normalizedText: string;
  order: number;
  selector?: string;
}

export interface PageContentBlock {
  id: string;
  type: PageBlockType;
  level?: number;
  listType?: 'ul' | 'ol';
  text: string;
  normalizedText: string;
  order: number;
  html?: string;
  tag?: string;
}

export interface PageTable {
  id: string;
  headers: string[];
  rows: string[][];
  order: number;
}

export interface PageImage {
  src: string;
  alt?: string;
  source: 'og:image' | 'twitter:image' | 'schema' | 'article' | 'hero' | 'first-content-image';
}

export interface PageFaqItem {
  question: string;
  answer: string;
}

export interface PageFaqData {
  present: boolean;
  items: PageFaqItem[];
  schemaPresent: boolean;
  schemaItems: PageFaqItem[];
  rawSchema?: any;
}

export interface PageExtractionDiagnostics {
  fetchMethod: 'direct-http' | 'rendered-browser' | 'manual-html';
  httpStatus?: number;
  htmlSize: number;
  rendered: boolean;
  detectedMainContentBlocks: number;
  detectedHeadings: number;
  detectedParagraphs: number;
  detectedTables: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  confidenceScore: number; // 0..100
  notes: string[];
}

export interface PageAuditModel {
  url: string;
  finalUrl?: string;
  meta: {
    titleTag?: string; // STRICT: only <title>
    metaDescription?: string; // STRICT: only <meta name="description">
    canonical?: string;
    openGraph?: {
      title?: string;
      description?: string;
      image?: string;
      url?: string;
    };
    twitter?: {
      title?: string;
      description?: string;
      image?: string;
    };
  };
  headings: PageHeading[];
  blocks: PageContentBlock[];
  tables: PageTable[];
  images: PageImage[];
  schemaTypes?: string[]; // every @type in the page's JSON-LD scripts
  altTexts?: string[]; // alt attribute of every <img> in the page source, duplicates kept
  faq: PageFaqData;
  extraction: PageExtractionDiagnostics;
}
