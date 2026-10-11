export type Priority = 'High' | 'Medium' | 'Low' | 'Info';

// One per Screaming Frog tab that has issue filters
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
  name: string; // Screaming Frog's filter name, e.g. "Over 60 Characters"
  priority: Priority;
  detail?: string;
}

export interface SchemaItem {
  type: string;
  format: 'JSON-LD' | 'Microdata' | 'RDFa';
  errors: string[];
  warnings: string[];
  richResult?: string; // Google rich result feature this type can trigger
  json?: unknown; // top-level JSON-LD nodes only
}

export interface SeoPage {
  address: string;
  error?: string; // the page could not be fetched
  title: string[]; // every <title> found
  titlePixels: number;
  description: string[]; // every meta description found
  descriptionPixels: number;
  h1: string[];
  h2: string[];
  canonical: string[];
  robots: string[]; // meta robots/googlebot directives, lowercased
  images: {
    total: number;
    missingAltAttribute: string[]; // src of images with no alt attribute
    missingAltText: string[]; // src of images with an empty alt
    altOver100: string[];
  };
  structuredData: { items: SchemaItem[]; errors: number; warnings: number };
  issues: SeoIssue[];
}

export interface SeoAuditResult {
  pages: SeoPage[];
  notices: string[];
}
