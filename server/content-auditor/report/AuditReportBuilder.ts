import type {
  ContentAuditReport,
  OverallAuditStatus,
  AuditIssue,
  MetadataComparison,
  HeadingComparison,
  BlockComparison,
  ListComparison,
  TableComparison,
  FeatureImageComparison,
  AltTextComparison,
  SchemaComparison,
  FaqComparison,
} from '../types/report';
import type { PageAuditModel } from '../types/page';
import type { ContentReference } from '../types/reference';
import { compareTextSimilarity } from '../comparison/TextMatcher';
import { computeWordDiff } from '../comparison/diff';
import { auditHeadings } from '../comparison/HeadingMatcher';
import { auditContentSequence } from '../comparison/SequenceMatcher';
import { auditLists } from '../comparison/ListMatcher';
import { auditTables } from '../comparison/TableMatcher';
import { auditFeatureImage } from '../comparison/ImageMatcher';
import { auditFaq } from '../comparison/FaqMatcher';
import { auditAltTexts } from '../comparison/AltTextMatcher';
import { auditSchemas } from '../comparison/SchemaMatcher';

export interface SelectedCheckOptions {
  title?: boolean;
  headings?: boolean;
  paragraphs?: boolean;
  lists?: boolean;
  tables?: boolean;
  image?: boolean;
  faq?: boolean;
}

export function buildContentAuditReport(
  page: PageAuditModel,
  ref: ContentReference,
  selectedChecks: SelectedCheckOptions = {}
): ContentAuditReport {
  const issues: AuditIssue[] = [];
  const recommendations: string[] = [];

  // Default all checks to true if none specified
  const checkTitle = selectedChecks.title !== false;
  const checkHeadings = selectedChecks.headings !== false;
  const checkParagraphs = selectedChecks.paragraphs !== false;
  const checkLists = selectedChecks.lists !== false;
  const checkTables = selectedChecks.tables !== false;
  const checkImage = selectedChecks.image !== false;
  const checkFaq = selectedChecks.faq !== false;

  // Check if reference or page extraction confidence is too low (Fix 10 & Fix 12 & Principle)
  const isReferenceLowConfidence =
    ref.extractionConfidence < 70 ||
    ref.diagnostics.unverifiedFields.includes('all');

  const isPageLowConfidence =
    page.extraction.confidence === 'LOW' && page.blocks.length === 0;

  // 1. Metadata Audit (Title, Meta Description, URL) - Fix 1 & Fix 2
  const expTitle = ref.meta.title || '';
  const actTitle = page.meta.titleTag || ''; // STRICT: Only titleTag
  const isTitleUnverified = ref.diagnostics.unverifiedFields.includes('meta.title') || !expTitle;

  let titleStatus: MetadataComparison['title']['status'] = 'UNVERIFIED';
  let titleDiff = undefined;

  if (checkTitle && !isTitleUnverified) {
    if (!actTitle) {
      titleStatus = 'MISSING';
      issues.push({
        id: 'meta-title-missing',
        category: 'metadata',
        severity: 'HIGH',
        message: 'Webpage is missing a <title> tag in the HTML head.',
        expected: expTitle,
        actual: '(missing)',
        evidence: 'No <title> tag found in HTML DOM',
      });
      recommendations.push('Add a descriptive <title> tag matching the reference to the webpage <head>.');
    } else {
      const sim = compareTextSimilarity(expTitle, actTitle);
      titleStatus = sim.status === 'EXACT' ? 'EXACT' : sim.status === 'NEAR_EXACT' ? 'NEAR_EXACT' : sim.status === 'PARTIAL' ? 'PARTIAL' : 'MISMATCH';
      if (titleStatus === 'PARTIAL' || titleStatus === 'MISMATCH') {
        titleDiff = computeWordDiff(expTitle, actTitle);
        issues.push({
          id: 'meta-title-mismatch',
          category: 'metadata',
          severity: titleStatus === 'PARTIAL' ? 'LOW' : 'MEDIUM',
          message: 'Title tag text differs from the reference title.',
          expected: expTitle,
          actual: actTitle,
          evidence: `<title>${actTitle}</title>`,
          difference: titleDiff,
        });
        recommendations.push('Update the <title> tag to match the reference document title.');
      }
    }
  }

  // Meta Description - Fix 2
  const expDesc = ref.meta.description || '';
  const actDesc = page.meta.metaDescription || ''; // STRICT: Only <meta name="description">
  const isDescUnverified = ref.diagnostics.unverifiedFields.includes('meta.description') || !expDesc;

  let descStatus: MetadataComparison['description']['status'] = 'UNVERIFIED';
  let descDiff = undefined;

  if (checkTitle && !isDescUnverified) {
    if (!actDesc) {
      descStatus = 'MISSING';
      issues.push({
        id: 'meta-desc-missing',
        category: 'metadata',
        severity: 'HIGH',
        message: 'Webpage is missing a <meta name="description"> tag.',
        expected: expDesc,
        actual: '(missing)',
        evidence: 'No <meta name="description"> tag found',
      });
      recommendations.push('Add a meta description tag (<meta name="description" content="...">) to the page.');
    } else {
      const sim = compareTextSimilarity(expDesc, actDesc);
      descStatus = sim.status === 'EXACT' ? 'EXACT' : sim.status === 'NEAR_EXACT' ? 'NEAR_EXACT' : sim.status === 'PARTIAL' ? 'PARTIAL' : 'MISMATCH';
      if (descStatus === 'PARTIAL' || descStatus === 'MISMATCH') {
        descDiff = computeWordDiff(expDesc, actDesc);
        issues.push({
          id: 'meta-desc-mismatch',
          category: 'metadata',
          severity: descStatus === 'PARTIAL' ? 'LOW' : 'MEDIUM',
          message: 'Meta description content differs from the reference document.',
          expected: expDesc,
          actual: actDesc,
          evidence: `<meta name="description" content="${actDesc}">`,
          difference: descDiff,
        });
        recommendations.push('Align the meta description with the reference document copy.');
      }
    }
  }

  // URL Comparison
  const expUrl = ref.url || '';
  const actUrl = page.meta.canonical || page.url || '';
  let urlStatus: MetadataComparison['url']['status'] = 'EXACT';
  if (checkTitle && expUrl) {
    const cleanExpUrl = expUrl.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase();
    const cleanActUrl = actUrl.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase();
    if (cleanExpUrl !== cleanActUrl) {
      urlStatus = 'MISMATCH';
      issues.push({
        id: 'url-mismatch',
        category: 'metadata',
        severity: 'MEDIUM',
        message: 'Published page URL or canonical URL differs from reference specification.',
        expected: expUrl,
        actual: actUrl,
        evidence: page.meta.canonical ? `<link rel="canonical" href="${page.meta.canonical}">` : `Input URL: ${page.url}`,
      });
      recommendations.push('Verify canonical link tag or publish URL matches the reference.');
    }
  }

  const metadata: MetadataComparison = {
    title: {
      expected: expTitle || 'No title specified in reference',
      actual: actTitle || '(No <title> tag found)',
      status: titleStatus,
      source: '<title>',
      evidence: actTitle ? `<title>${actTitle}</title>` : undefined,
      difference: titleDiff,
    },
    description: {
      expected: expDesc || 'No description specified in reference',
      actual: actDesc || '(No <meta name="description"> found)',
      status: descStatus,
      source: '<meta name="description">',
      evidence: actDesc ? `<meta name="description" content="${actDesc}">` : undefined,
      difference: descDiff,
    },
    url: {
      expected: expUrl || 'No URL specified in reference',
      actual: actUrl,
      status: urlStatus,
      source: page.meta.canonical ? 'canonical' : 'url',
    },
    overallStatus: (titleStatus === 'EXACT' || titleStatus === 'NEAR_EXACT') && (descStatus === 'EXACT' || descStatus === 'NEAR_EXACT') && urlStatus === 'EXACT'
      ? 'PASS'
      : (titleStatus === 'UNVERIFIED' || descStatus === 'UNVERIFIED')
        ? 'UNVERIFIED'
        : (titleStatus === 'PARTIAL' || descStatus === 'PARTIAL')
          ? 'PARTIAL'
          : 'FAIL',
  };

  // 2. Heading Audit - Fix 3 & Fix 4
  let headingComparisons: HeadingComparison[] = [];
  if (checkHeadings && ref.headings.length > 0) {
    headingComparisons = auditHeadings(ref.headings, page.headings, page.blocks);
    headingComparisons.forEach((hc) => {
      if (hc.status === 'MISSING') {
        issues.push({
          id: `heading-missing-${hc.expectedOrder}`,
          category: 'heading',
          severity: 'HIGH',
          message: `Expected heading <h${hc.expectedLevel}> "${hc.expectedText}" is missing from the webpage.`,
          expected: `<h${hc.expectedLevel}> ${hc.expectedText}`,
          actual: '(missing)',
          evidence: hc.evidence,
        });
      } else if (hc.status === 'WRONG_LEVEL') {
        issues.push({
          id: `heading-wrong-level-${hc.expectedOrder}`,
          category: 'heading',
          severity: 'MEDIUM',
          message: `Heading "${hc.expectedText}" has structural mismatch: expected <h${hc.expectedLevel}>, actual <${hc.actualLevel ? `h${hc.actualLevel}` : 'p'}>.`,
          expected: `H${hc.expectedLevel} ${hc.expectedText}`,
          actual: `${hc.actualLevel ? `H${hc.actualLevel}` : 'P'} ${hc.actualText || ''}`,
          evidence: hc.evidence,
        });
      } else if (hc.status === 'WRONG_ORDER') {
        issues.push({
          id: `heading-wrong-order-${hc.expectedOrder}`,
          category: 'order',
          severity: 'MEDIUM',
          message: `Heading "${hc.expectedText}" appears out of expected order.`,
          expected: `Position #${hc.expectedOrder}`,
          actual: `Position #${hc.actualOrder}`,
          evidence: hc.evidence,
        });
      } else if (hc.status === 'PARTIAL' || hc.status === 'MISMATCH') {
        issues.push({
          id: `heading-copy-${hc.expectedOrder}`,
          category: 'heading',
          severity: hc.status === 'PARTIAL' ? 'LOW' : 'MEDIUM',
          message: `Heading copy differs from reference: "${hc.expectedText}" vs "${hc.actualText}".`,
          expected: hc.expectedText,
          actual: hc.actualText,
          evidence: hc.evidence,
          difference: hc.difference,
        });
      }
    });
  }

  // 3. Body Copy Sequence Audit - Fix 20, Fix 21, Fix 22, Fix 30, Fix 31
  let blockComparisons: BlockComparison[] = [];
  if (checkParagraphs && ref.blocks.length > 0) {
    const paragraphRefBlocks = ref.blocks.filter((b) => b.type === 'paragraph');
    const paragraphPageBlocks = page.blocks.filter((b) => b.type === 'paragraph');
    const seq = auditContentSequence(paragraphRefBlocks, paragraphPageBlocks);
    blockComparisons = seq.comparisons;

    seq.comparisons.forEach((bc) => {
      if (bc.status === 'MISSING') {
        issues.push({
          id: `content-missing-${bc.id}`,
          category: 'body-copy',
          severity: 'HIGH',
          message: `Expected paragraph missing from webpage main content: "${bc.expected.slice(0, 60)}..."`,
          expected: bc.expected,
          actual: '(not found on page)',
          evidence: bc.evidence,
        });
      } else if (bc.status === 'MOVED' || bc.status === 'WRONG_ORDER') {
        issues.push({
          id: `content-moved-${bc.id}`,
          category: 'order',
          severity: 'MEDIUM',
          message: `Paragraph content appears out of order: expected position #${bc.expectedOrder}, found at #${bc.actualOrder}.`,
          expected: `Position #${bc.expectedOrder}: ${bc.expected.slice(0, 50)}...`,
          actual: `Position #${bc.actualOrder}: ${bc.actual?.slice(0, 50)}...`,
          evidence: bc.evidence,
        });
      } else if (bc.status === 'PARTIAL' || bc.status === 'MISMATCH') {
        issues.push({
          id: `content-diff-${bc.id}`,
          category: 'body-copy',
          severity: bc.status === 'PARTIAL' ? 'LOW' : 'MEDIUM',
          message: `Paragraph copy difference detected (${Math.round(bc.similarity * 100)}% match).`,
          expected: bc.expected,
          actual: bc.actual,
          evidence: bc.evidence,
          difference: bc.difference,
        });
      }
    });

    // Extra content detection
    seq.extraBlocks.forEach((eb) => {
      issues.push({
        id: `content-extra-${eb.id}`,
        category: 'body-copy',
        severity: 'INFO',
        message: `Extra content detected on page not present in reference: "${eb.actual?.slice(0, 60)}..."`,
        actual: eb.actual,
        evidence: eb.evidence,
      });
    });
  }

  // 4. List Audit - Fix 29
  let listComparisons: ListComparison[] = [];
  if (checkLists) {
    const expLists: Array<{ type: 'ul' | 'ol'; items: string[] }> = [];
    let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;

    for (const b of ref.blocks) {
      if (b.type === 'listItem') {
        const lType = b.listType || 'ul';
        if (!currentList || currentList.type !== lType) {
          if (currentList) expLists.push(currentList);
          currentList = { type: lType, items: [b.text] };
        } else {
          currentList.items.push(b.text);
        }
      } else {
        if (currentList) {
          expLists.push(currentList);
          currentList = null;
        }
      }
    }
    if (currentList) expLists.push(currentList);

    const actLists: Array<{ type: 'ul' | 'ol'; items: string[] }> = [];
    let currentActList: { type: 'ul' | 'ol'; items: string[] } | null = null;
    for (const b of page.blocks) {
      if (b.type === 'listItem') {
        const lType = b.listType || 'ul';
        if (!currentActList || currentActList.type !== lType) {
          if (currentActList) actLists.push(currentActList);
          currentActList = { type: lType, items: [b.text] };
        } else {
          currentActList.items.push(b.text);
        }
      } else {
        if (currentActList) {
          actLists.push(currentActList);
          currentActList = null;
        }
      }
    }
    if (currentActList) actLists.push(currentActList);

    if (expLists.length > 0) {
      listComparisons = auditLists(expLists, actLists);
      listComparisons.forEach((lc, idx) => {
        if (lc.status === 'MISSING') {
          issues.push({
            id: `list-missing-${idx}`,
            category: 'list',
            severity: 'HIGH',
            message: `Expected ${lc.type.toUpperCase()} list (#${idx + 1}) is missing from webpage.`,
            expected: lc.expectedItems.join('\n'),
            actual: '(missing)',
            evidence: lc.evidence,
          });
        } else if (lc.status === 'WRONG_ORDER') {
          issues.push({
            id: `list-order-${idx}`,
            category: 'order',
            severity: 'MEDIUM',
            message: `Ordered list (#${idx + 1}) items appear out of sequence.`,
            expected: lc.expectedItems.join(' -> '),
            actual: lc.actualItems.join(' -> '),
            evidence: lc.evidence,
          });
        }
      });
    }
  }

  // 5. Table Audit - Fix 28
  let tableComparisons: TableComparison[] = [];
  if (checkTables && ref.tables.length > 0) {
    tableComparisons = auditTables(ref.tables, page.tables);
    tableComparisons.forEach((tc, idx) => {
      if (tc.status === 'MISSING') {
        issues.push({
          id: `table-missing-${idx}`,
          category: 'table',
          severity: 'HIGH',
          message: `Expected table #${idx + 1} is missing from webpage.`,
          evidence: tc.evidence,
        });
      } else if (tc.status === 'PARTIAL') {
        issues.push({
          id: `table-partial-${idx}`,
          category: 'table',
          severity: 'MEDIUM',
          message: `Table #${idx + 1} has ${tc.missingRows.length} missing row(s).`,
          evidence: tc.evidence,
        });
      }
    });
  }

  // 6. Feature Image Audit - Fix 24 & Fix 25
  let featureImageComparison: FeatureImageComparison | undefined = undefined;
  if (checkImage) {
    featureImageComparison = auditFeatureImage(ref.featureImage, page.images);
    if (featureImageComparison.applicable && !featureImageComparison.matches) {
      issues.push({
        id: 'feature-image-mismatch',
        category: 'image',
        severity: 'MEDIUM',
        message: 'Featured image does not match the image specified in the reference document.',
        expected: featureImageComparison.expected,
        actual: featureImageComparison.actual,
        evidence: featureImageComparison.evidence,
      });
      recommendations.push('Set the webpage Open Graph and featured image to match the reference asset.');
    }
  }

  // 6b. Alt text from the reference must exist on an <img> in the page source (and not be duplicated)
  let altTextComparisons: AltTextComparison[] = [];
  if (checkImage && ref.altTexts?.length) {
    const pageAlts = page.altTexts || [];
    altTextComparisons = auditAltTexts(ref.altTexts, pageAlts);
    altTextComparisons.forEach((a, idx) => {
      if (a.status === 'MISSING') {
        issues.push({
          id: `alt-text-missing-${idx}`,
          category: 'alt-text',
          severity: 'MEDIUM',
          message: `Alt text from the reference was not found on any image: "${a.expected}".`,
          expected: a.expected,
          actual: '(not found)',
          evidence: `Checked ${pageAlts.length} <img alt> attribute(s) in the page source.`,
        });
      } else if (a.duplicate) {
        issues.push({
          id: `alt-text-duplicate-${idx}`,
          category: 'alt-text',
          severity: 'LOW',
          message: `Alt text "${a.expected}" is used on ${a.pageCount} images; the reference lists it ${a.expectedCount}.`,
          expected: a.expected,
          actual: `${a.pageCount} images`,
          evidence: `${a.pageCount} <img> tags in the page source carry this alt attribute.`,
        });
      }
    });
    if (altTextComparisons.some((a) => a.status === 'MISSING')) {
      recommendations.push('Add the missing alt text from the reference to the matching <img> tags.');
    }
    if (altTextComparisons.some((a) => a.duplicate)) {
      recommendations.push('Give duplicated alt text a unique description per image.');
    }
  }

  // 7. FAQ and Schema Audit - Fix 26 & Fix 27
  let faqComparison: FaqComparison | undefined = undefined;
  if (checkFaq) {
    const requiresSchema = (ref.requiredSchema || []).some((s) => /faq/i.test(s));
    faqComparison = auditFaq(ref.faq, page.faq, requiresSchema);

    if (faqComparison.status === 'MISSING' && ref.faq.length > 0) {
      issues.push({
        id: 'faq-section-missing',
        category: 'schema',
        severity: 'HIGH',
        message: 'Expected FAQ section was not found on the webpage.',
        expected: `${ref.faq.length} FAQ questions & answers`,
        actual: '(not found)',
        evidence: faqComparison.evidence,
      });
      recommendations.push('Add the expected FAQ section to the webpage.');
    } else if (faqComparison.status === 'PARTIAL') {
      issues.push({
        id: 'faq-section-partial',
        category: 'schema',
        severity: 'MEDIUM',
        message: 'Some FAQ questions or answers do not match the reference content.',
        evidence: faqComparison.evidence,
      });
      recommendations.push('Align FAQ questions and answers with the reference document.');
    }

    if (requiresSchema && !page.faq.schemaPresent) {
      issues.push({
        id: 'faq-schema-missing',
        category: 'schema',
        severity: 'MEDIUM',
        message: 'Reference specifies required FAQPage schema, but no FAQPage JSON-LD was detected.',
        expected: 'FAQPage schema',
        actual: '(none detected)',
        evidence: 'HTML head contains no FAQPage JSON-LD script',
      });
      recommendations.push('Add FAQPage JSON-LD structured data for the FAQ section.');
    }
  }

  // 7b. Schema pasted into the reference doc must be present on the page as JSON-LD
  let schemaComparisons: SchemaComparison[] = [];
  if (checkFaq && ref.schemaBlocks?.length) {
    schemaComparisons = auditSchemas(ref.schemaBlocks, page.schemaTypes || []);
    schemaComparisons.forEach((s, idx) => {
      if (s.status === 'MISSING') {
        issues.push({
          id: `schema-doc-missing-${idx}`,
          category: 'schema',
          severity: 'HIGH',
          message: `Schema from the reference is missing on the page: ${s.missingTypes.join(', ')}.`,
          expected: s.types.join(', '),
          actual: (page.schemaTypes || []).join(', ') || '(no JSON-LD found)',
          evidence: 'Compared @type values of the reference schema with the page JSON-LD scripts.',
        });
        recommendations.push(`Add the ${s.missingTypes.join(', ')} JSON-LD schema from the reference to the page.`);
      } else if (s.status === 'INVALID') {
        issues.push({
          id: `schema-doc-invalid-${idx}`,
          category: 'schema',
          severity: 'LOW',
          message: 'A schema block in the reference could not be read as JSON-LD, so it was not checked.',
          evidence: 'Check the schema in the doc for broken JSON or a missing @type.',
        });
      }
    });
  }

  // 8. Tally Issue Counts and Compute Weighted Category Score - Fix 33 & Fix 34
  const criticalCount = issues.filter((i) => i.severity === 'CRITICAL').length;
  const structuralCount = issues.filter((i) => i.category === 'heading' && i.severity !== 'LOW' || i.category === 'order').length;
  const contentDiffCount = issues.filter((i) => (i.category === 'body-copy' || i.category === 'metadata' || i.category === 'alt-text' || i.id.startsWith('schema-doc-')) && (i.severity === 'HIGH' || i.severity === 'MEDIUM')).length;
  const minorDiffCount = issues.filter((i) => i.severity === 'LOW').length;

  let totalChecks = 0;
  let passedChecks = 0;
  let unverifiedChecks = 0;

  // Title & Desc
  if (checkTitle) {
    totalChecks += 2;
    if (metadata.title.status === 'EXACT' || metadata.title.status === 'NEAR_EXACT') passedChecks++;
    else if (metadata.title.status === 'UNVERIFIED') unverifiedChecks++;

    if (metadata.description.status === 'EXACT' || metadata.description.status === 'NEAR_EXACT') passedChecks++;
    else if (metadata.description.status === 'UNVERIFIED') unverifiedChecks++;
  }

  // Headings
  if (checkHeadings) {
    headingComparisons.forEach((h) => {
      totalChecks++;
      if (h.status === 'EXACT' || h.status === 'NEAR_EXACT') passedChecks++;
    });
  }

  // Body Copy
  if (checkParagraphs) {
    blockComparisons.forEach((b) => {
      totalChecks++;
      if (b.status === 'EXACT' || b.status === 'NEAR_EXACT') passedChecks++;
    });
  }

  // Lists
  if (checkLists) {
    listComparisons.forEach((l) => {
      totalChecks++;
      if (l.status === 'EXACT' || l.status === 'NEAR_EXACT') passedChecks++;
    });
  }

  // Tables
  if (checkTables) {
    tableComparisons.forEach((t) => {
      totalChecks++;
      if (t.status === 'EXACT') passedChecks++;
    });
  }

  // Image
  if (checkImage && featureImageComparison?.applicable) {
    totalChecks++;
    if (featureImageComparison.matches) passedChecks++;
  }

  // Alt text
  altTextComparisons.forEach((a) => {
    totalChecks++;
    if (a.status === 'FOUND' && !a.duplicate) passedChecks++;
  });

  // Doc schema
  schemaComparisons.forEach((s) => {
    if (s.status === 'INVALID') return unverifiedChecks++;
    totalChecks++;
    if (s.status === 'FOUND') passedChecks++;
  });

  // FAQ
  if (checkFaq && ref.faq.length > 0) {
    totalChecks++;
    if (faqComparison?.status === 'EXACT') passedChecks++;
  }

  // Overall status evaluation - Fix 32
  let overallStatus: OverallAuditStatus = 'PASS';

  if (isReferenceLowConfidence || isPageLowConfidence) {
    overallStatus = 'UNVERIFIED';
    issues.unshift({
      id: 'low-extraction-confidence',
      category: 'extraction',
      severity: 'CRITICAL',
      message: isReferenceLowConfidence
        ? 'Reference extraction confidence is too low to produce a dependable audit report.'
        : 'Webpage extraction returned too little meaningful content to make a dependable judgment.',
      evidence: `Reference confidence: ${ref.extractionConfidence}%, Page blocks: ${page.blocks.length}`,
    });
  } else if (criticalCount > 0 || structuralCount > 0 || contentDiffCount > 0) {
    overallStatus = 'FAIL';
  } else if (minorDiffCount > 0) {
    overallStatus = 'PASS_WITH_MINOR_DIFFERENCES';
  }

  // Approximate category weights (Fix 34):
  // URL: 5, Title: 10, Meta Description: 10, Heading Structure: 15, Body Copy: 30, Lists/Tables: 10, Content Order: 10, Feature Image: 5, Schema: 5
  let scoreNumerator = 0;
  let scoreDenominator = 0;

  if (checkTitle) {
    scoreDenominator += 25; // 5 URL + 10 Title + 10 Desc
    if (metadata.url.status === 'EXACT') scoreNumerator += 5;
    if (metadata.title.status === 'EXACT' || metadata.title.status === 'NEAR_EXACT') scoreNumerator += 10;
    else if (metadata.title.status === 'PARTIAL') scoreNumerator += 5;
    if (metadata.description.status === 'EXACT' || metadata.description.status === 'NEAR_EXACT') scoreNumerator += 10;
    else if (metadata.description.status === 'PARTIAL') scoreNumerator += 5;
  }

  if (checkHeadings && headingComparisons.length > 0) {
    scoreDenominator += 25; // 15 Structure + 10 Order
    const exactHeadings = headingComparisons.filter((h) => h.status === 'EXACT' || h.status === 'NEAR_EXACT').length;
    scoreNumerator += Math.round((exactHeadings / headingComparisons.length) * 25);
  }

  if (checkParagraphs && blockComparisons.length > 0) {
    scoreDenominator += 30; // 30 Body Copy
    const exactBlocks = blockComparisons.filter((b) => b.status === 'EXACT' || b.status === 'NEAR_EXACT').length;
    scoreNumerator += Math.round((exactBlocks / blockComparisons.length) * 30);
  }

  if (checkLists && listComparisons.length > 0) {
    scoreDenominator += 5;
    const exactLists = listComparisons.filter((l) => l.status === 'EXACT').length;
    scoreNumerator += Math.round((exactLists / listComparisons.length) * 5);
  }

  if (checkTables && tableComparisons.length > 0) {
    scoreDenominator += 5;
    const exactTables = tableComparisons.filter((t) => t.status === 'EXACT').length;
    scoreNumerator += Math.round((exactTables / tableComparisons.length) * 5);
  }

  if (checkImage && featureImageComparison?.applicable) {
    scoreDenominator += 5;
    if (featureImageComparison.matches) scoreNumerator += 5;
  }

  if (checkFaq && ref.faq.length > 0) {
    scoreDenominator += 5;
    if (faqComparison?.status === 'EXACT') scoreNumerator += 5;
    else if (faqComparison?.status === 'PARTIAL') scoreNumerator += 3;
  }

  const overallScore = scoreDenominator > 0 ? Math.round((scoreNumerator / scoreDenominator) * 100) : 100;

  const headline = overallStatus === 'PASS'
    ? 'All audited sections match the reference specifications.'
    : overallStatus === 'PASS_WITH_MINOR_DIFFERENCES'
      ? `Audit passed with ${minorDiffCount} minor cosmetic or punctuation difference(s).`
      : overallStatus === 'UNVERIFIED'
        ? 'Audit status is UNVERIFIED due to low extraction confidence.'
        : `Audit failed with ${structuralCount} structural and ${contentDiffCount} content mismatch(es).`;

  return {
    status: overallStatus,
    extraction: {
      page: page.extraction,
      reference: {
        source: ref.source === 'google-doc' ? 'Google Docs' : ref.source === 'screenshot' ? 'Screenshot OCR' : 'Manual Input',
        confidence: ref.extractionConfidence >= 90 ? 'HIGH' : ref.extractionConfidence >= 75 ? 'MEDIUM' : 'LOW',
        confidenceScore: ref.extractionConfidence,
        characterCount: ref.diagnostics.characterCount,
        blockCount: ref.diagnostics.blockCount,
        lineCount: ref.diagnostics.lineCount,
        tileCount: ref.diagnostics.tileCount,
        ocrConfidence: ref.diagnostics.ocrConfidence,
        unverifiedFields: ref.diagnostics.unverifiedFields,
        notes: ref.diagnostics.notes,
      },
    },
    metadata,
    headings: headingComparisons,
    content: blockComparisons,
    lists: listComparisons,
    tables: tableComparisons,
    featureImage: featureImageComparison,
    altTexts: altTextComparisons,
    schemas: schemaComparisons,
    faq: faqComparison,
    issues,
    summary: {
      status: overallStatus,
      criticalIssues: criticalCount,
      structuralIssues: structuralCount,
      contentDifferences: contentDiffCount,
      minorDifferences: minorDiffCount,
      passedChecks,
      unverifiedChecks,
      totalChecks,
      overallScore,
      headline,
      recommendations,
    },
  };
}
