export type ReferenceBlockType =
  | 'heading'
  | 'paragraph'
  | 'listItem'
  | 'tableRow'
  | 'tableCell'
  | 'metadata'
  | 'other';

export interface ReferenceHeading {
  id: string;
  level: number; // 1..6
  text: string;
  normalizedText: string;
  order: number;
}

export interface ReferenceBlock {
  id: string;
  type: ReferenceBlockType;
  level?: number; // for headings
  listType?: 'ul' | 'ol';
  text: string;
  normalizedText: string;
  order: number;
  sourceLocation?: string;
}

export interface ReferenceTable {
  id: string;
  headers: string[];
  rows: string[][];
  order: number;
}

export interface ReferenceFaq {
  question: string;
  answer: string;
  order: number;
}

export interface ContentReference {
  url?: string;
  meta: {
    title?: string;
    description?: string;
    canonical?: string;
    primaryKeyword?: string;
    secondaryKeywords?: string[];
  };
  featureImage?: string;
  headings: ReferenceHeading[];
  blocks: ReferenceBlock[];
  tables: ReferenceTable[];
  faq: ReferenceFaq[];
  requiredSchema?: string[];
  source: 'google-doc' | 'screenshot' | 'upload' | 'manual';
  extractionConfidence: number; // 0..100
  diagnostics: {
    characterCount: number;
    blockCount: number;
    lineCount: number;
    tileCount?: number;
    ocrConfidence?: number;
    unverifiedFields: string[];
    notes: string[];
  };
}
