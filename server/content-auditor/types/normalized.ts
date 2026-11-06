import type { AltTextComparison, FaqSchemaCheck, LinkCheck, MetaCheck, SchemaComparison, UrlCheck } from './report';

export type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export type SemanticTag =
  | HeadingTag
  | 'p'
  | 'ul'
  | 'ol'
  | 'table';

export type NormalizedElementType = 'heading' | 'paragraph' | 'list' | 'table';

/** A hyperlink as written: visible anchor text and the raw href */
export interface LinkRef {
  text: string;
  href: string;
}

export interface BaseNormalizedElement {
  id: string;
  type: NormalizedElementType;
  tag: SemanticTag;
  text: string;
  links?: LinkRef[];
}

export interface HeadingElement extends BaseNormalizedElement {
  type: 'heading';
  tag: HeadingTag;
  level: number;
}

export interface ParagraphElement extends BaseNormalizedElement {
  type: 'paragraph';
  tag: 'p';
  sourceTag?: string;
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

export type ComparisonStatus = 'PASS' | 'WRONG_TAG' | 'WRONG_ORDER' | 'CONTENT_MISMATCH' | 'MISSING';

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
  outOfOrder?: boolean;
  /** CONTENT_MISMATCH where only case or punctuation differs: a warning, not a failure */
  minor?: boolean;
}

export interface AuditSummary {
  total: number;
  passed: number;
  wrongTag: number;
  wrongOrder: number;
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
  altTexts?: AltTextComparison[];
  links?: LinkCheck[];
  /** Links in the page's main content that the doc does not have (informational) */
  extraLinks?: LinkRef[];
  schemas?: SchemaComparison[];
  urlCheck?: UrlCheck;
  metaChecks?: MetaCheck[];
  faqSchema?: FaqSchemaCheck;
  page?: { url: string; title?: string; description?: string; canonical?: string };
  /** The doc tab that was audited (from the link; none = first tab) and whether the doc has others */
  docTab?: { id?: string; hasOtherTabs?: boolean };
  /** Things the reader must know to trust the result, shown above it */
  notices?: string[];
}
