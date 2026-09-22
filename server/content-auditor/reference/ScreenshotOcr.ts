import Tesseract from 'tesseract.js';
import { normalizeText } from './ReferenceNormalizer';

export interface OcrTileResult {
  tileIndex: number;
  text: string;
  confidence: number;
  lines: Array<{ text: string; confidence: number; top: number; bottom: number }>;
}

export interface OcrExtractionResult {
  text: string;
  overallConfidence: number;
  confidenceTier: 'HIGH' | 'MEDIUM' | 'LOW';
  characterCount: number;
  lineCount: number;
  tileCount: number;
  isSuspicious: boolean;
  notes: string[];
}

/**
 * Extracts width and height from PNG / JPEG buffers without native dependencies.
 */
function getImageDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;

  // PNG: signature 0x89 0x50 0x4E 0x47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return { width, height };
  }

  // JPEG: starts with 0xFF 0xD8
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset < buf.length) {
      if (buf[offset] !== 0xff) break;
      const marker = buf[offset + 1];
      // Baseline / Progressive SOF markers: 0xC0, 0xC1, 0xC2
      if (marker >= 0xc0 && marker <= 0xc3) {
        const height = buf.readUInt16BE(offset + 5);
        const width = buf.readUInt16BE(offset + 7);
        return { width, height };
      }
      const length = buf.readUInt16BE(offset + 2);
      offset += 2 + length;
    }
  }

  return null;
}

/**
 * Performs high-resolution tiled OCR on screenshot images.
 * Fix 9: Prevents downscaling long vertical screenshots into unreadable text.
 * Fix 10: Calculates overall confidence and assigns HIGH / MEDIUM / LOW tiers.
 * Fix 11: Explicit failure on timeout rather than silent empty return.
 * Fix 12: Validates result against image dimensions to detect suspicious / corrupted outputs.
 */
export async function performTiledOcr(
  imageBase64: string,
  options: { timeoutMs?: number; tileHeight?: number; overlap?: number } = {}
): Promise<OcrExtractionResult> {
  const timeoutMs = options.timeoutMs ?? 45000;
  const tileH = options.tileHeight ?? 1800;
  const overlap = options.overlap ?? 250;

  if (!imageBase64 || !imageBase64.trim()) {
    throw new Error('OCR_FAILED: No screenshot image data provided.');
  }

  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Buffer.from(cleanBase64, 'base64');

  if (imageBuffer.length === 0) {
    throw new Error('OCR_FAILED: Empty image buffer.');
  }

  const dims = getImageDimensions(imageBuffer);
  const width = dims?.width || 1200;
  const height = dims?.height || 2000;

  // Determine if tiling is necessary (image height > 2400px)
  const isTallImage = height > 2400;
  const tiles: Array<{ top: number; height: number }> = [];

  if (isTallImage) {
    let currentTop = 0;
    while (currentTop < height) {
      const remaining = height - currentTop;
      const currentHeight = Math.min(tileH, remaining);
      tiles.push({ top: currentTop, height: currentHeight });
      currentTop += (tileH - overlap);
      if (remaining <= tileH) break;
    }
  } else {
    tiles.push({ top: 0, height });
  }

  const notes: string[] = [];
  const recognizedLines: Array<{ text: string; confidence: number }> = [];
  let totalConfidenceSum = 0;
  let totalLineCount = 0;

  // Run OCR with explicit timeout promise
  const ocrJob = async () => {
    // If not tall, standard full recognition
    if (tiles.length <= 1) {
      const res = await Tesseract.recognize(imageBuffer, 'eng', {
        langPath: process.cwd(),
        cacheMethod: 'readOnly',
      });
      const data = res.data as any;
      const rawLines: any[] = data.lines || [];
      const lines = rawLines.map((l: any) => ({
        text: normalizeText(l.text),
        confidence: l.confidence || 0,
      })).filter((l: { text: string }) => l.text.length > 0);

      const avgConf = data.confidence || (lines.length > 0 ? lines.reduce((acc: number, l: any) => acc + l.confidence, 0) / lines.length : 0);
      return {
        text: data.text || lines.map((l: any) => l.text).join('\n'),
        confidence: avgConf,
        lines,
        tileCount: 1,
      };
    }

    // Tiled recognition
    for (let t = 0; t < tiles.length; t++) {
      const tile = tiles[t];
      const res = await Tesseract.recognize(imageBuffer, 'eng', {
        langPath: process.cwd(),
        cacheMethod: 'readOnly',
        rectangle: {
          left: 0,
          top: tile.top,
          width,
          height: tile.height,
        },
      } as any);

      const tileData = res.data as any;
      const rawTileLines: any[] = tileData.lines || [];
      const tileLines = rawTileLines.map((l: any) => ({
        text: normalizeText(l.text),
        confidence: l.confidence || 0,
      })).filter((l: { text: string }) => l.text.length > 0);

      for (const line of tileLines) {
        // De-duplicate boundary overlaps between adjacent tiles
        const isDuplicate = recognizedLines.slice(-6).some((prev) => {
          return prev.text === line.text || (prev.text.length > 10 && line.text.includes(prev.text));
        });

        if (!isDuplicate) {
          recognizedLines.push(line);
          totalConfidenceSum += line.confidence;
          totalLineCount++;
        }
      }
    }

    const avgConf = totalLineCount > 0 ? Math.round(totalConfidenceSum / totalLineCount) : 0;
    return {
      text: recognizedLines.map((l) => l.text).join('\n'),
      confidence: avgConf,
      lines: recognizedLines,
      tileCount: tiles.length,
    };
  };

  let ocrResult: { text: string; confidence: number; lines: any[]; tileCount: number };
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`OCR_TIMEOUT: Screenshot OCR exceeded time limit of ${timeoutMs / 1000}s.`)), timeoutMs);
    });
    ocrResult = await Promise.race([ocrJob(), timeoutPromise]);
  } catch (err: any) {
    throw new Error(`OCR_FAILED: ${err.message || err}`);
  }

  const cleanText = ocrResult.text.trim();
  const overallConfidence = ocrResult.confidence;
  const characterCount = cleanText.length;
  const lineCount = ocrResult.lines.length;

  // Fix 10: Thresholds: HIGH >= 90, MEDIUM >= 75, LOW < 75
  const confidenceTier: 'HIGH' | 'MEDIUM' | 'LOW' =
    overallConfidence >= 90 ? 'HIGH' : overallConfidence >= 75 ? 'MEDIUM' : 'LOW';

  // Fix 12: Validate OCR result
  let isSuspicious = false;
  if (height > 2000 && characterCount < 100) {
    isSuspicious = true;
    notes.push('Suspiciously low character count for a high-resolution screenshot.');
  }

  if (confidenceTier === 'LOW') {
    notes.push(`OCR average confidence (${overallConfidence}%) is below reliable threshold (75%).`);
  }

  if (ocrResult.tileCount > 1) {
    notes.push(`Processed ${ocrResult.tileCount} high-resolution vertical tiles.`);
  }

  return {
    text: cleanText,
    overallConfidence,
    confidenceTier,
    characterCount,
    lineCount,
    tileCount: ocrResult.tileCount,
    isSuspicious,
    notes,
  };
}
