import type { PageExtractionDiagnostics } from './page';

export type OverallAuditStatus = 'PASS' | 'PASS_WITH_MINOR_DIFFERENCES' | 'FAIL' | 'UNVERIFIED';

export type BlockComparisonStatus =
  | 'EXACT'
  | 'NEAR_EXACT'
  | 'PARTIAL'
  | 'MISMATCH'
  | 'MISSING'
  | 'EXTRA'
  | 'MOVED'
  | 'WRONG_LEVEL'
  | 'WRONG_ORDER';

export type IssueSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type DifferenceCategory =
  | 'metadata'
  | 'heading'
  | 'body-copy'
  | 'list'
  | 'table'
  | 'order'
  | 'image'
  | 'alt-text'
  | 'schema'
  | 'extraction'
  | 'fetch';

export interface DiffWord {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export interface AuditIssue {
  id: string;
  category: DifferenceCategory;
  severity: IssueSeverity;
  message: string;
  expected?: string;
  actual?: string;
  evidence?: string;
  difference?: DiffWord[];
}

export interface MetadataComparisonItem {
  expected: string;
  actual: string;
  status: 'EXACT' | 'NEAR_EXACT' | 'PARTIAL' | 'MISMATCH' | 'MISSING' | 'UNVERIFIED';
  source?: string;
  evidence?: string;
  difference?: DiffWord[];
}

export interface MetadataComparison {
  title: MetadataComparisonItem;
  description: MetadataComparisonItem;
  url: MetadataComparisonItem;
  canonical?: MetadataComparisonItem;
  overallStatus: 'PASS' | 'PARTIAL' | 'FAIL' | 'UNVERIFIED';
}

export interface HeadingComparison {
  expectedText: string;
  expectedLevel: number;
  actualText?: string;
  actualLevel?: number;
  expectedOrder: number;
  actualOrder?: number;
  copyMatch: 'EXACT' | 'NEAR_EXACT' | 'PARTIAL' | 'MISMATCH' | 'MISSING';
  structureMatch: 'EXACT' | 'WRONG_LEVEL' | 'FAIL';
  status: BlockComparisonStatus;
  similarity: number;
  evidence?: string;
  difference?: DiffWord[];
}

export interface BlockComparison {
  id: string;
  type: string;
  expected: string;
  actual?: string;
  expectedOrder: number;
  actualOrder?: number;
  status: BlockComparisonStatus;
  similarity: number;
  copyMatch: 'PASS' | 'PARTIAL' | 'FAIL';
  structureMatch: 'PASS' | 'FAIL';
  evidence?: string;
  difference?: DiffWord[];
}

export interface ListComparison {
  type: 'ul' | 'ol';
  expectedItems: string[];
  actualItems: string[];
  status: BlockComparisonStatus;
  missingItems: string[];
  extraItems: string[];
  orderMatches: boolean;
  evidence?: string;
}

export interface TableComparison {
  id: string;
  expectedRows: string[][];
  actualRows: string[][];
  status: BlockComparisonStatus;
  rowMatches: number;
  totalExpectedRows: number;
  missingRows: string[][];
  evidence?: string;
}

export interface FeatureImageComparison {
  applicable: boolean;
  expected: string;
  actual: string;
  source?: string;
  status: 'EXACT' | 'NORMALIZED_MATCH' | 'FILENAME_MATCH' | 'MISMATCH' | 'MISSING' | 'NOT_APPLICABLE';
  matches: boolean;
  evidence?: string;
}

export interface AltTextComparison {
  expected: string;
  status: 'FOUND' | 'MISSING';
  pageCount: number; // <img> tags on the page carrying this alt text
  expectedCount: number; // times the reference lists it
  duplicate: boolean; // on more images than the reference lists
}

export interface SchemaComparison {
  types: string[]; // @type values the doc's schema declares
  status: 'FOUND' | 'MISSING' | 'INVALID'; // INVALID = the doc's schema couldn't be read as JSON-LD
  missingTypes: string[];
}

export interface FaqComparison {
  present: boolean;
  status: 'EXACT' | 'PARTIAL' | 'MISMATCH' | 'MISSING' | 'NOT_REQUIRED';
  schemaPresent: boolean;
  schemaCorrespondsToContent: boolean;
  itemComparisons: Array<{
    expectedQuestion: string;
    expectedAnswer: string;
    actualQuestion?: string;
    actualAnswer?: string;
    questionMatch: boolean;
    answerMatch: boolean;
    status: BlockComparisonStatus;
  }>;
  evidence?: string;
  notes?: string[];
}

export interface AuditSummary {
  status: OverallAuditStatus;
  criticalIssues: number;
  structuralIssues: number;
  contentDifferences: number;
  minorDifferences: number;
  passedChecks: number;
  unverifiedChecks: number;
  totalChecks: number;
  overallScore: number; // 0..100 weighted
  headline: string;
  recommendations: string[];
}

export interface ReferenceDiagnostics {
  source: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  confidenceScore: number;
  characterCount: number;
  blockCount: number;
  lineCount: number;
  tileCount?: number;
  ocrConfidence?: number;
  unverifiedFields: string[];
  notes: string[];
}

export interface ContentAuditReport {
  status: OverallAuditStatus;
  extraction: {
    page: PageExtractionDiagnostics;
    reference: ReferenceDiagnostics;
  };
  metadata: MetadataComparison;
  headings: HeadingComparison[];
  content: BlockComparison[];
  lists: ListComparison[];
  tables: TableComparison[];
  featureImage?: FeatureImageComparison;
  altTexts?: AltTextComparison[];
  schemas?: SchemaComparison[];
  faq?: FaqComparison;
  issues: AuditIssue[];
  summary: AuditSummary;
}
