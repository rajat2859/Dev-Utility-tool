export type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export type SemanticTag =
  | HeadingTag
  | 'p'
  | 'ul'
  | 'ol'
  | 'table';

export type NormalizedElementType = 'heading' | 'paragraph' | 'list' | 'table';

export interface BaseNormalizedElement {
  id: string;
  type: NormalizedElementType;
  tag: SemanticTag;
  text: string;
}

export interface HeadingElement extends BaseNormalizedElement {
  type: 'heading';
  tag: HeadingTag;
  level: number;
}

export interface ParagraphElement extends BaseNormalizedElement {
  type: 'paragraph';
  tag: 'p';
}

export interface ListElement extends BaseNormalizedElement {
  type: 'list';
  tag: 'ul' | 'ol';
  items: string[];
}

export interface TableElement extends BaseNormalizedElement {
  type: 'table';
  tag: 'table';
  rows: string[][];
}

export type NormalizedElement =
  | HeadingElement
  | ParagraphElement
  | ListElement
  | TableElement;

export interface NormalizedDocument {
  title?: string;
  elements: NormalizedElement[];
  metadata?: {
    url?: string;
    title?: string;
    description?: string;
    [key: string]: string | undefined;
  };
}

export type ComparisonStatus = 'PASS' | 'WRONG_TAG' | 'CONTENT_MISMATCH' | 'MISSING';

export interface ElementComparisonResult {
  id: string;
  order: number;
  status: ComparisonStatus;
  reference: {
    tag: SemanticTag;
    type: NormalizedElementType;
    text: string;
    items?: string[];
    rows?: string[][];
  };
  website?: {
    tag: string;
    type: string;
    text: string;
    items?: string[];
    rows?: string[][];
  };
  message: string;
}

export interface AuditSummary {
  total: number;
  passed: number;
  wrongTag: number;
  contentMismatch: number;
  missing: number;
  extraOnWebsite: number;
  status: 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';
}

export interface ContentAuditReport {
  summary: AuditSummary;
  results: ElementComparisonResult[];
  referenceTree: NormalizedDocument;
  websiteTree: NormalizedDocument;
  extraWebsiteElements: NormalizedElement[];
}
