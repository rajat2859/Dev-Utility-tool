import type { ContentReference } from '../types/reference';
import { parseGoogleDocReference } from './GoogleDocParser';
import { performTiledOcr, type OcrExtractionResult } from './ScreenshotOcr';

export interface ReferenceInput {
  referenceText?: string;
  imageBase64?: string;
  docUrl?: string;
  sourceType?: 'google-doc' | 'screenshot' | 'manual';
}

export async function parseReference(input: ReferenceInput): Promise<ContentReference> {
  if (input.referenceText && input.referenceText.trim()) {
    const raw = input.referenceText.trim();
    const parsed = parseGoogleDocReference(raw, input.docUrl);
    parsed.source = input.sourceType === 'manual' ? 'manual' : 'google-doc';
    return parsed;
  }

  if (input.imageBase64 && input.imageBase64.trim()) {
    let ocr: OcrExtractionResult;
    try {
      ocr = await performTiledOcr(input.imageBase64);
    } catch (err: any) {
      throw new Error(`OCR extraction failed: ${err.message || err}`);
    }

    const parsed = parseGoogleDocReference(ocr.text);
    parsed.source = 'screenshot';
    parsed.extractionConfidence = ocr.overallConfidence;
    parsed.diagnostics.characterCount = ocr.characterCount;
    parsed.diagnostics.lineCount = ocr.lineCount;
    parsed.diagnostics.tileCount = ocr.tileCount;
    parsed.diagnostics.ocrConfidence = ocr.overallConfidence;
    parsed.diagnostics.notes.push(...ocr.notes);

    if (ocr.confidenceTier === 'LOW' || ocr.isSuspicious) {
      parsed.diagnostics.unverifiedFields.push('all');
      parsed.diagnostics.notes.push('Reference extraction confidence is too low for a reliable audit.');
    }

    return parsed;
  }

  throw new Error('REFERENCE_PARSE_FAILED: No reference text or screenshot image provided.');
}
