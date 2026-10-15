export type Priority = 'High' | 'Medium' | 'Low' | 'Info';

export type IssueTab =
  | 'Page Titles'
  | 'Meta Description'
  | 'H1'
  | 'H2'
  | 'Images'
  | 'Canonicals'
  | 'Directives'
  | 'Structured Data';

export interface SeoIssue {
  tab: IssueTab;
  name: string;
  priority: Priority;
  detail?: string;
}

export interface SchemaItem {
  type: string;
  format: 'JSON-LD' | 'Microdata' | 'RDFa';
  errors: string[];
  warnings: string[];
  richResult?: string;
  json?: unknown;
}

export interface SeoPage {
  address: string;
  error?: string;
  title: string[];
  titlePixels: number;
  description: string[];
  descriptionPixels: number;
  h1: string[];
  h2: string[];
  canonical: string[];
  robots: string[];
  images: {
    total: number;
    missingAltAttribute: string[];
    missingAltText: string[];
    altOver100: string[];
  };
  structuredData: { items: SchemaItem[]; errors: number; warnings: number };
  issues: SeoIssue[];
}

export interface SeoAuditResult {
  pages: SeoPage[];
  notices: string[];
}
