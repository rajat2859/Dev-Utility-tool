import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Trash2, Download, RefreshCw, Check, AlertCircle, FileCode, Sliders, ChevronDown, Info, TrendingDown, TrendingUp, Minus, Sparkles, Zap, Copy, Code, X } from 'lucide-react';
import JSZip from 'jszip';
import { copyText } from '../../lib/utils';

export type CompressionMode = 'below100kb' | 'balanced' | 'high';

export const MODE_QUALITIES: Record<CompressionMode, number> = {
  below100kb: 0.65,
  balanced: 0.82,
  high: 0.55,
};

interface ImageFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  previewUrl: string;
  width: number;
  height: number;
  targetFormat: 'png' | 'jpeg' | 'webp' | 'svg' | 'avif';
  quality: number; // 0.1 to 1.0 (for jpeg/webp/avif)
  svgMode: 'embed' | 'trace';
  compressionMode: CompressionMode;
  status: 'pending' | 'processing' | 'completed' | 'error';
  convertedDataUrl?: string;
  convertedSize?: number;
  svgCode?: string;
  errorMessage?: string;
}

type ImageSource = ImageBitmap | HTMLImageElement;

const FORMAT_MIME: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
};

// Safari blanks canvases past ~4096 on the short edge and every browser has a
// total-area cap; clamp instead of silently producing a transparent image.
const MAX_CANVAS_DIM = 4096;

// Four at a time. Each conversion holds a full-resolution canvas, so firing the
// whole queue through one Promise.all is what makes large batches kill the tab.
const CONCURRENCY = 4;

// Under-100 KB mode: a 12 MP source can never hit the target at a usable
// quality, so cap the long edge up front — it also makes trial encodes cheap.
const UNDER_TARGET_MAX_EDGE = 1600;

// createImageBitmap decodes off the main thread and is several times faster than
// an <img>; SVG sources with no intrinsic size still need the <img> path.
async function decodeImage(file: File, url: string): Promise<ImageSource> {
  try {
    const bitmap = await createImageBitmap(file);
    if (bitmap.width && bitmap.height) return bitmap;
    bitmap.close();
  } catch {
    /* fall through to the <img> decoder */
  }
  const el = new Image();
  el.src = url;
  await el.decode();
  el.width = el.naturalWidth;
  el.height = el.naturalHeight;
  return el;
}

const releaseSource = (src: ImageSource | null) => {
  if (src && 'close' in src) src.close();
};

const fitDimensions = (w: number, h: number, scale = 1): [number, number] => {
  const s = Math.min(scale, MAX_CANVAS_DIM / Math.max(w, h, 1));
  return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))];
};

function render(src: ImageSource, w: number, h: number, opaque: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context.');
  ctx.imageSmoothingQuality = 'high';
  if (opaque) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(src, 0, 0, w, h);
  return { canvas, ctx };
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

// Downscale first, then walk a quality ladder, then downscale again. Returns the
// smallest blob produced; the caller compares blob.type to spot a format the
// browser silently refused to encode.
async function encodeUnderTarget(
  src: ImageSource,
  w: number,
  h: number,
  mimeType: string,
  maxBytes = 100 * 1024
): Promise<{ blob: Blob; quality: number } | null> {
  // PNG ignores the quality argument, so scale is the only lever it has --
  // give it more passes to make up for the ladder it can't walk.
  const lossless = mimeType === 'image/png';
  const ladder = lossless ? [1] : [0.8, 0.5, 0.3, 0.15];
  let scale = Math.min(1, UNDER_TARGET_MAX_EDGE / Math.max(w, h, 1));
  let best: { blob: Blob; quality: number } | null = null;

  for (let pass = 0; pass < (lossless ? 7 : 4); pass++) {
    const [cw, ch] = fitDimensions(w, h, scale);
    const { canvas } = render(src, cw, ch, mimeType === 'image/jpeg');
    for (const quality of ladder) {
      const blob = await toBlob(canvas, mimeType, quality);
      if (!blob) return best;
      if (blob.type !== mimeType) return { blob, quality };
      if (!best || blob.size < best.blob.size) best = { blob, quality };
      if (blob.size <= maxBytes) return best;
    }
    if (Math.max(cw, ch) <= 64) break;
    scale *= 0.6;
  }
  return best;
}

const EMBEDDABLE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const buildEmbedSvg = (canvas: HTMLCanvasElement, w: number, h: number, sourceType: string) => {
  const href = canvas.toDataURL(EMBEDDABLE_TYPES.has(sourceType) ? sourceType : 'image/png');
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <image width="${w}" height="${h}" xlink:href="${href}" />
</svg>`;
};

const performSvgTrace = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): string => {
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  // One path segment per sampled dark pixel, so the grid has to stay coarse
  // enough that a big photo can't build a multi-megabyte string and freeze the tab.
  // ponytail: threshold trace, swap in a real vectorizer if quality matters.
  const step = Math.max(4, Math.ceil(Math.sqrt((width * height) / 40000)));
  const segments: string[] = [];

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const luma = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      if (data[idx + 3] > 128 && luma < 128) {
        segments.push(`M${x},${y}h${step}v${step}h-${step}z`);
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <path d="${segments.join(' ')}" fill="#000000" />
</svg>`;
};

const baseNameOf = (name: string) => name.substring(0, name.lastIndexOf('.')) || name;


export default function ImageConverter() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [globalFormat, setGlobalFormat] = useState<'png' | 'jpeg' | 'webp' | 'svg' | 'avif'>('webp');
  const [globalCompressionMode, setGlobalCompressionMode] = useState<CompressionMode>('balanced');
  const [globalSvgMode, setGlobalSvgMode] = useState<'embed' | 'trace'>('embed');
  const [activeSvgModal, setActiveSvgModal] = useState<{ name: string; code: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopySvgCode = (id: string, code: string) => {
    copyText(code).then((ok) => {
      if (!ok) return;
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 2000);
    });
  };

  const handleGlobalCompressionChange = (mode: CompressionMode) => {
    setGlobalCompressionMode(mode);
  };

  const revokeUrls = (img: Pick<ImageFile, 'previewUrl' | 'convertedDataUrl'>) => {
    if (img.previewUrl.startsWith('blob:')) URL.revokeObjectURL(img.previewUrl);
    if (img.convertedDataUrl?.startsWith('blob:')) URL.revokeObjectURL(img.convertedDataUrl);
  };

  // A ref, because the unmount cleanup would otherwise read the empty array
  // captured at mount and leak every object URL the session created.
  const imagesRef = useRef<ImageFile[]>([]);
  useEffect(() => { imagesRef.current = images; }, [images]);
  useEffect(() => () => { imagesRef.current.forEach(revokeUrls); }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Dragging across a child fires dragleave on the parent; ignore those.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDragging(false);
  };

  const processFiles = async (files: FileList) => {
    const validImageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (validImageFiles.length === 0) return;

    const added = await Promise.all(
      validImageFiles.map(async (file): Promise<ImageFile> => {
        const previewUrl = URL.createObjectURL(file);
        let width = 0;
        let height = 0;
        try {
          const src = await decodeImage(file, previewUrl);
          width = src.width;
          height = src.height;
          releaseSource(src);
        } catch {
          /* width/height stay 0 and the entry is flagged below */
        }
        const broken = !width || !height;
        return {
          id: Math.random().toString(36).substring(2, 9),
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          previewUrl,
          width,
          height,
          targetFormat: globalFormat,
          quality: MODE_QUALITIES[globalCompressionMode],
          svgMode: globalSvgMode,
          compressionMode: globalCompressionMode,
          status: broken ? 'error' : 'pending',
          errorMessage: broken ? 'Invalid image format or corrupted file.' : undefined,
        };
      })
    );

    // One state update keeps upload order stable instead of racing on decode time.
    setImages((prev) => [...prev, ...added]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    // Without this, picking the same file twice in a row fires no change event.
    e.target.value = '';
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) revokeUrls(target);
      return prev.filter((img) => img.id !== id);
    });
  };

  const clearAll = () => {
    images.forEach(revokeUrls);
    setImages([]);
  };

  const applyGlobalConfig = () => {
    setImages((prev) =>
      prev.map((img) => {
        if (img.convertedDataUrl?.startsWith('blob:')) URL.revokeObjectURL(img.convertedDataUrl);
        return {
          ...img,
          targetFormat: globalFormat,
          compressionMode: globalCompressionMode,
          quality: MODE_QUALITIES[globalCompressionMode],
          svgMode: globalSvgMode,
          status: 'pending' as const,
          convertedDataUrl: undefined,
          convertedSize: undefined,
          errorMessage: undefined,
        };
      })
    );
  };

  const updateIndividualImage = <K extends keyof ImageFile>(id: string, key: K, value: ImageFile[K]) => {
    setImages((prev) =>
      prev.map((img) => {
        if (img.id === id) {
          if (img.convertedDataUrl?.startsWith('blob:')) URL.revokeObjectURL(img.convertedDataUrl);
          const updated = { ...img, [key]: value };
          if (key === 'compressionMode') {
            const mode = value as CompressionMode;
            updated.quality = MODE_QUALITIES[mode];
          }
          return {
            ...updated,
            status: 'pending',
            convertedDataUrl: undefined,
            convertedSize: undefined,
            errorMessage: undefined
          };
        }
        return img;
      })
    );
  };

  const convertSingleImage = async (imgFile: ImageFile): Promise<ImageFile> => {
    const fail = (errorMessage: string): ImageFile => ({ ...imgFile, status: 'error', errorMessage });
    const done = (blob: Blob, extra?: Partial<ImageFile>): ImageFile => ({
      ...imgFile,
      status: 'completed',
      convertedDataUrl: URL.createObjectURL(blob),
      convertedSize: blob.size,
      errorMessage: undefined,
      ...extra,
    });

    let src: ImageSource | null = null;
    try {
      src = await decodeImage(imgFile.file, imgFile.previewUrl);
      const sw = src.width;
      const sh = src.height;
      if (!sw || !sh) return fail('Cannot process invalid dimensions.');

      if (imgFile.targetFormat === 'svg') {
        const [cw, ch] = fitDimensions(sw, sh);
        const { canvas, ctx } = render(src, cw, ch, false);
        const svgText =
          imgFile.svgMode === 'trace'
            ? performSvgTrace(canvas, ctx)
            : buildEmbedSvg(canvas, cw, ch, imgFile.type);
        return done(new Blob([svgText], { type: 'image/svg+xml' }), { svgCode: svgText });
      }

      const mimeType = FORMAT_MIME[imgFile.targetFormat];
      const unsupported = `${imgFile.targetFormat.toUpperCase()} is not supported by your browser; encoded as WebP instead.`;

      if (imgFile.compressionMode === 'below100kb') {
        const overshot = (blob: Blob) =>
          blob.size > 100 * 1024
            ? 'Could not reach 100 KB without destroying the image; this is the smallest usable result.'
            : undefined;

        const result = await encodeUnderTarget(src, sw, sh, mimeType);
        if (!result) return fail('Blob generation failed in Under 100 KB mode.');
        if (result.blob.type === mimeType) {
          return done(result.blob, { quality: result.quality, errorMessage: overshot(result.blob) });
        }

        const fallback = mimeType === 'image/webp' ? null : await encodeUnderTarget(src, sw, sh, 'image/webp');
        if (!fallback) return fail(`${imgFile.targetFormat.toUpperCase()} fallback to WebP failed.`);
        return done(fallback.blob, { quality: fallback.quality, errorMessage: unsupported });
      }

      const [cw, ch] = fitDimensions(sw, sh);
      const { canvas } = render(src, cw, ch, imgFile.targetFormat === 'jpeg');
      const blob = await toBlob(canvas, mimeType, imgFile.quality);
      if (!blob) return fail('Blob generation returned null.');
      if (blob.type === mimeType || mimeType === 'image/webp') return done(blob);

      // toBlob silently falls back to PNG for a format it can't encode (usually AVIF).
      const fallback = await toBlob(canvas, 'image/webp', imgFile.quality);
      if (!fallback) return fail(`${imgFile.targetFormat.toUpperCase()} fallback to WebP failed.`);
      return done(fallback, { errorMessage: unsupported });
    } catch (e: any) {
      return fail(e?.message || 'Error occurred during rendering.');
    } finally {
      releaseSource(src);
      // The replacement URL is already minted above, so the old one is dead.
      if (imgFile.convertedDataUrl?.startsWith('blob:')) URL.revokeObjectURL(imgFile.convertedDataUrl);
    }
  };

  // Merges each result by id so files removed mid-run aren't resurrected by a
  // stale snapshot, which is what writing the whole array back used to do.
  const runQueue = async (targets: ImageFile[]): Promise<ImageFile[]> => {
    const results: ImageFile[] = [];
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, targets.length) }, async () => {
        while (cursor < targets.length) {
          const result = await convertSingleImage({ ...targets[cursor++], status: 'processing' });
          results.push(result);
          setImages((prev) => prev.map((img) => (img.id === result.id ? result : img)));
        }
      })
    );
    return results;
  };

  const markProcessing = (ids: Set<string>) => {
    setImages((prev) => prev.map((img) => (ids.has(img.id) ? { ...img, status: 'processing' } : img)));
  };

  const handleConvertAll = async () => {
    const targets = images.filter((img) => img.status !== 'completed');
    if (targets.length === 0) return;
    markProcessing(new Set(targets.map((img) => img.id)));
    await runQueue(targets);
  };

  const triggerDownload = (img: ImageFile, fileName?: string) => {
    if (!img.convertedDataUrl) return;
    const link = document.createElement('a');
    link.href = img.convertedDataUrl;
    link.download = fileName ?? `${baseNameOf(img.name)}_converted.${img.targetFormat}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSingle = async (img: ImageFile) => {
    if (img.status === 'completed') {
      triggerDownload(img);
      return;
    }
    if (img.status === 'processing') return;

    markProcessing(new Set([img.id]));
    const [result] = await runQueue([img]);
    if (result?.status === 'completed') triggerDownload(result);
  };

  const handleDownloadAll = async () => {
    const pending = images.filter((img) => img.status === 'pending' || img.status === 'error');
    let completed = images.filter((img) => img.status === 'completed');

    if (pending.length > 0) {
      markProcessing(new Set(pending.map((img) => img.id)));
      const results = await runQueue(pending);
      completed = [...completed, ...results.filter((img) => img.status === 'completed')];
    }
    if (completed.length === 0) return;

    // Same source name twice would silently overwrite inside the zip.
    const used = new Set<string>();
    const uniqueName = (img: ImageFile) => {
      const base = baseNameOf(img.name);
      let name = `${base}_converted.${img.targetFormat}`;
      for (let n = 2; used.has(name); n++) name = `${base}_converted_${n}.${img.targetFormat}`;
      used.add(name);
      return name;
    };
    const named = completed.map((img) => [img, uniqueName(img)] as const);

    if (named.length > 5) {
      try {
        const zip = new JSZip();
        await Promise.all(
          named.map(async ([img, name]) => {
            const blob = await fetch(img.convertedDataUrl!).then((r) => r.blob());
            zip.file(name, blob);
          })
        );
        const zipContent = await zip.generateAsync({ type: 'blob' });
        const zipUrl = URL.createObjectURL(zipContent);
        const link = document.createElement('a');
        link.href = zipUrl;
        link.download = `converted_images_${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(zipUrl);
        return;
      } catch (err) {
        console.error('ZIP generation failed, downloading individually', err);
      }
    }

    named.forEach(([img, name], idx) => {
      setTimeout(() => triggerDownload(img, name), idx * 250);
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getProjectedSize = (img: ImageFile): number => {
    if (img.width === 0 || img.height === 0) return 0;
    
    const originalPixels = img.width * img.height;
    const originalBpp = (img.size * 8) / originalPixels;
    
    let baseBpp = originalBpp;
    if (img.type.includes('png') || img.type.includes('svg')) {
      baseBpp = Math.min(originalBpp, 2.8);
    }
    baseBpp = Math.min(Math.max(baseBpp, 0.4), 6.5);
    
    const targetQuality = img.quality;
    let projectedBytes = img.size;

    if (img.compressionMode === 'below100kb') {
      const cap = 96 * 1024;
      if (img.size <= 100 * 1024) {
        projectedBytes = Math.min(img.size, Math.round(img.size * 0.75));
      } else if (img.size > 1024 * 1024) {
        projectedBytes = Math.min(cap, 92 * 1024 + (img.size % 4000));
      } else {
        projectedBytes = Math.min(cap, Math.round(img.size * 0.6));
      }
      return Math.round(projectedBytes);
    }

    if (img.targetFormat === 'png') {
      if (img.type.includes('png')) {
        projectedBytes = img.size;
      } else {
        const pngBpp = Math.max(originalBpp * 2.2, 3.5);
        projectedBytes = (originalPixels * pngBpp) / 8;
        projectedBytes = Math.max(projectedBytes, img.size * 1.15);
      }
    } else if (img.targetFormat === 'webp') {
      let webpBpp = baseBpp * 0.28 * Math.pow(targetQuality, 1.5);
      if (targetQuality > 0.9) {
        webpBpp += (targetQuality - 0.9) * 5;
      }
      webpBpp = Math.max(webpBpp, 0.18);
      projectedBytes = (originalPixels * webpBpp) / 8;
    } else if (img.targetFormat === 'avif') {
      let avifBpp = baseBpp * 0.18 * Math.pow(targetQuality, 1.4);
      if (targetQuality > 0.9) {
        avifBpp += (targetQuality - 0.9) * 3.5;
      }
      avifBpp = Math.max(avifBpp, 0.12);
      projectedBytes = (originalPixels * avifBpp) / 8;
    } else if (img.targetFormat === 'jpeg') {
      let jpegBpp = baseBpp * 0.42 * Math.pow(targetQuality, 1.5);
      if (targetQuality > 0.9) {
        jpegBpp += (targetQuality - 0.9) * 9;
      }
      jpegBpp = Math.max(jpegBpp, 0.32);
      projectedBytes = (originalPixels * jpegBpp) / 8;
    } else if (img.targetFormat === 'svg') {
      if (img.svgMode === 'trace') {
        const estimatedRectsCount = (originalPixels * 0.08); 
        return Math.min(estimatedRectsCount * 65 + 200, img.size * 12);
      } else {
        const embedBpp = img.type.includes('png') ? originalBpp : originalBpp * 1.1;
        const rawBytes = (originalPixels * embedBpp) / 8;
        return rawBytes * 1.37 + 250;
      }
    }
    
    projectedBytes = Math.max(projectedBytes, 1500);
    return Math.round(projectedBytes);
  };

  const totalOriginalSize = images.reduce((acc, img) => acc + img.size, 0);
  const totalProjectedSize = images.reduce((acc, img) => {
    return acc + (img.convertedSize || getProjectedSize(img));
  }, 0);
  
  const totalSavingsPct = totalOriginalSize > 0 
    ? Math.round(((totalProjectedSize - totalOriginalSize) / totalOriginalSize) * 100)
    : 0;

  return (
    <div className="space-y-6 text-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4 border-slate-200">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">Bulk Image Format Converter</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
              <Zap className="h-3 w-3 text-amber-500" />
              100% Offline Local Processing
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Batch-convert files securely in browser. Conversions run purely locally on your device.
          </p>
        </div>
        {images.length > 0 && (
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white text-rose-600 px-2.5 py-1 text-xs font-medium hover:bg-rose-50 transition-colors cursor-pointer shadow-xs"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Files
          </button>
        )}
      </div>

      {/* Global Config Settings Bar */}
      <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
          <Sliders className="h-4 w-4 text-blue-600" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-900">Global Configurations (Bulk Edit)</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 flex items-center justify-between">
              <span>Target Output</span>
              <span className="text-[10px] font-mono font-semibold text-slate-900 uppercase">{globalFormat}</span>
            </label>
            <div className="relative">
              <select
                value={globalFormat}
                onChange={(e) => setGlobalFormat(e.target.value as any)}
                className="w-full text-xs font-medium rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-900 focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer shadow-xs"
              >
                <option value="webp">WebP (Optimized/Modern)</option>
                <option value="avif">AVIF (Ultra Optimized)</option>
                <option value="png">PNG (Lossless/Transparent)</option>
                <option value="jpeg">JPEG (High Compatibility)</option>
                <option value="svg">SVG (Scale Vector Graphic)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-slate-400">
                <ChevronDown className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 block">
              Compression Mode
            </label>
            <div className="relative">
              <select
                value={globalCompressionMode}
                onChange={(e) => handleGlobalCompressionChange(e.target.value as any)}
                className="w-full text-xs font-medium rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-900 focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer shadow-xs"
              >
                <option value="below100kb">Under 100 KB (Guaranteed Target)</option>
                <option value="balanced">Balanced (82% Quality)</option>
                <option value="high">Max Compress (55% Quality)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-slate-400">
                <ChevronDown className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>

          {globalFormat === 'svg' ? (
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 block">SVG Vector Mode</label>
              <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 border border-slate-200 rounded-md">
                <button
                  type="button"
                  onClick={() => setGlobalSvgMode('embed')}
                  className={`py-1 text-xs font-medium rounded cursor-pointer ${
                    globalSvgMode === 'embed' ? 'bg-white shadow-xs text-slate-900 font-semibold' : 'text-slate-500'
                  }`}
                >
                  Embed
                </button>
                <button
                  type="button"
                  onClick={() => setGlobalSvgMode('trace')}
                  className={`py-1 text-xs font-medium rounded cursor-pointer ${
                    globalSvgMode === 'trace' ? 'bg-white shadow-xs text-slate-900 font-semibold' : 'text-slate-500'
                  }`}
                >
                  Trace
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 block">Mode Specification</label>
              <div className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-md text-slate-600 flex items-center gap-1.5 h-[34px]">
                <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span className="truncate">
                  {globalCompressionMode === 'below100kb' && 'Multi-pass under 100 KB'}
                  {globalCompressionMode === 'balanced' && '82% balanced quality & size'}
                  {globalCompressionMode === 'high' && '55% maximum compression'}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-end">
            <button
              onClick={applyGlobalConfig}
              disabled={images.length === 0}
              className="w-full text-xs font-medium py-1.5 px-3 bg-blue-600 text-white hover:bg-blue-700 rounded-md shadow-xs cursor-pointer transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed h-[34px]"
            >
              Apply to Queue
            </button>
          </div>
        </div>
      </div>

      {/* Real-Time Sizing Impact & Projection Insights */}
      {(() => {
        const sampleImage: ImageFile = {
          id: 'sample',
          file: new File([], 'sample_photo.jpg'),
          name: 'sample_photo.jpg',
          size: 2500000,
          type: 'image/jpeg',
          previewUrl: '',
          width: 4000,
          height: 3000,
          targetFormat: globalFormat,
          quality: MODE_QUALITIES[globalCompressionMode],
          svgMode: globalSvgMode,
          compressionMode: globalCompressionMode,
          status: 'pending'
        };

        const isQueueEmpty = images.length === 0;
        const activeOriginalSize = isQueueEmpty ? 2500000 : totalOriginalSize;
        const activeProjectedSize = isQueueEmpty ? getProjectedSize(sampleImage) : totalProjectedSize;
        const activeSavingsPct = Math.round(((activeProjectedSize - activeOriginalSize) / activeOriginalSize) * 100);

        return (
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-2xs">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-900">Sizing Forecast Simulator</h3>
                  <p className="text-[11px] text-slate-500">
                    {isQueueEmpty ? 'Mode: Simulated Sample (2.5MB JPEG)' : 'Mode: Active Queue Sizing'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-0.5 rounded border ${
                  activeSavingsPct < 0
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : activeSavingsPct === 0
                      ? 'text-slate-600 bg-slate-100 border-slate-200'
                      : 'text-amber-700 bg-amber-50 border-amber-200'
                }`}>
                  {activeSavingsPct < 0 ? (
                    <><TrendingDown className="h-3.5 w-3.5" /> Saves {Math.abs(activeSavingsPct)}%</>
                  ) : activeSavingsPct === 0 ? (
                    <><Minus className="h-3.5 w-3.5" /> No change</>
                  ) : (
                    <><TrendingUp className="h-3.5 w-3.5" /> +{activeSavingsPct}% size</>
                  )}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Size Comparison</span>
                <span className="font-mono text-slate-900 font-semibold">
                  {formatBytes(activeOriginalSize)} → {formatBytes(activeProjectedSize)}
                </span>
              </div>

              <div className="h-3 bg-slate-200 rounded-full overflow-hidden flex relative">
                {activeSavingsPct < 0 ? (
                  <>
                    <div 
                      className="bg-slate-900 h-full transition-all duration-300" 
                      style={{ width: `${Math.max(10, 100 + activeSavingsPct)}%` }}
                    />
                    <div className="bg-emerald-500 h-full opacity-80 flex-1" />
                  </>
                ) : (
                  <>
                    <div 
                      className="bg-slate-900 h-full transition-all duration-300" 
                      style={{ width: `${Math.max(20, Math.round((activeOriginalSize / activeProjectedSize) * 100))}%` }}
                    />
                    <div className="bg-amber-500 h-full flex-1" />
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Drag & Drop Canvas Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-200 hover:border-blue-300 bg-slate-50/50'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          accept="image/*"
          className="hidden"
        />
        <div className="h-10 w-10 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center mb-3 text-slate-700">
          <UploadCloud className="h-5 w-5" />
        </div>
        <span className="text-xs font-semibold text-slate-900 block mb-1">
          Drag and drop images here or click to browse
        </span>
        <span className="text-[11px] text-slate-400">
          Supports PNG, JPEG, SVG, WebP, GIF, BMP, TIFF formats.
        </span>
      </div>

      {/* Uploaded Images Table List */}
      {images.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-slate-50">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-slate-900">Queue ({images.length} files)</span>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                <span>Original: {formatBytes(totalOriginalSize)}</span>
                <span>•</span>
                <span>Projected: ~{formatBytes(totalProjectedSize)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleConvertAll}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 shadow-xs cursor-pointer transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5 text-blue-200" />
                Convert All
              </button>
              
              <button
                onClick={handleDownloadAll}
                disabled={images.length === 0 || images.every((img) => img.status === 'processing')}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-900 border border-slate-200 rounded-md text-xs font-medium hover:bg-slate-200 shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="h-3.5 w-3.5" />
                Download Batch
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 overflow-x-auto">
            {images.map((img) => (
              <div key={img.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                
                {/* Visual File Preview Column */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-12 w-12 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-100 flex items-center justify-center relative">
                    <img
                      src={img.previewUrl}
                      alt={img.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-slate-900 block truncate" title={img.name}>
                      {img.name}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 font-mono">
                      <span>{formatBytes(img.size)}</span>
                      <span>•</span>
                      <span>{img.width}x{img.height}px</span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Format, Mode, Size & Actions */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 shrink-0 justify-end">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">Format</span>
                    <select
                      value={img.targetFormat}
                      onChange={(e) => updateIndividualImage(img.id, 'targetFormat', e.target.value as any)}
                      className="text-xs font-medium rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-900 focus:ring-2 focus:ring-blue-500/50 shadow-xs cursor-pointer"
                    >
                      <option value="webp">WebP</option>
                      <option value="avif">AVIF</option>
                      <option value="png">PNG</option>
                      <option value="jpeg">JPEG</option>
                      <option value="svg">SVG</option>
                    </select>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">Mode</span>
                    <select
                      value={img.compressionMode}
                      onChange={(e) => updateIndividualImage(img.id, 'compressionMode', e.target.value as any)}
                      className="text-xs font-medium rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-900 focus:ring-2 focus:ring-blue-500/50 shadow-xs cursor-pointer"
                    >
                      <option value="below100kb">Under 100 KB</option>
                      <option value="balanced">Balanced</option>
                      <option value="high">Max Compress</option>
                    </select>
                  </div>

                  <div className="space-y-0.5 text-right min-w-[70px]">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">Size</span>
                    <div>
                      {img.status === 'pending' && (
                        <span className="text-xs font-mono text-slate-500">
                          ~{formatBytes(getProjectedSize(img))}
                        </span>
                      )}
                      {img.status === 'processing' && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
                          <RefreshCw className="h-3 w-3 animate-spin text-blue-600" />
                          Converting...
                        </span>
                      )}
                      {img.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold font-mono">
                          <Check className="h-3 w-3" />
                          {img.convertedSize && formatBytes(img.convertedSize)}
                        </span>
                      )}
                      {img.status === 'error' && (
                        <span className="inline-flex items-center gap-1 text-xs text-rose-600 font-medium">
                          <AlertCircle className="h-3 w-3" />
                          Failed
                        </span>
                      )}
                    </div>
                    {img.errorMessage && img.status !== 'processing' && (
                      <p
                        className={`text-[10px] leading-snug mt-0.5 max-w-[180px] ${
                          img.status === 'error' ? 'text-rose-500' : 'text-amber-600'
                        }`}
                        title={img.errorMessage}
                      >
                        {img.errorMessage}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1 pt-3.5 sm:pt-3">
                    {img.targetFormat === 'svg' && img.status === 'completed' && img.svgCode && (
                      <>
                        <button
                          onClick={() => handleCopySvgCode(img.id, img.svgCode!)}
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 text-xs font-medium cursor-pointer shadow-xs transition-colors"
                          title="Copy Raw SVG XML Code"
                        >
                          {copiedId === img.id ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-semibold text-[11px]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span className="text-[11px]">Copy SVG</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => setActiveSvgModal({ name: img.name, code: img.svgCode! })}
                          className="p-1.5 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 cursor-pointer shadow-xs transition-colors"
                          title="View & Inspect SVG XML Code"
                        >
                          <Code className="h-3.5 w-3.5 text-blue-600" />
                        </button>
                      </>
                    )}

                    {img.status === 'completed' ? (
                      <button
                        onClick={() => triggerDownload(img)}
                        className="p-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-xs transition-colors"
                        title="Download Asset"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDownloadSingle(img)}
                        className="p-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-xs transition-colors"
                        title="Convert & Download Asset"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => removeImage(img.id)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-slate-100 cursor-pointer transition-colors"
                      title="Remove file"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                </div>

              </div>
            ))}
          </div>
        </div>
      )}

      {/* SVG Code Inspector Modal */}
      {activeSvgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" onClick={() => setActiveSvgModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-slate-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50">
              <div className="flex items-center gap-2 min-w-0">
                <FileCode className="h-4 w-4 text-blue-600 shrink-0" />
                <h3 className="text-xs font-semibold text-slate-900 truncate">SVG Source Code: {activeSvgModal.name}</h3>
              </div>
              <button
                onClick={() => setActiveSvgModal(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200/60 cursor-pointer transition-colors shrink-0"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-auto bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed select-all">
              <pre className="whitespace-pre-wrap break-all">{activeSvgModal.code}</pre>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-400 font-mono">
                {activeSvgModal.code.length.toLocaleString()} characters ({formatBytes(activeSvgModal.code.length)})
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopySvgCode('modal', activeSvgModal.code)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-xs font-medium cursor-pointer shadow-xs transition-colors"
                >
                  {copiedId === 'modal' ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy SVG Markup</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setActiveSvgModal(null)}
                  className="px-3 py-1.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-medium cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Developer tips footer */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-slate-500 text-xs leading-relaxed flex items-start gap-2.5">
        <FileCode className="h-4 w-4 text-slate-700 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-semibold text-slate-900 block">Digital Format Engineering Tips</span>
          <p>
            • <strong className="text-slate-900">WebP</strong> offers ~30% smaller sizes than PNG while keeping alpha transparency.
          </p>
        </div>
      </div>
    </div>
  );
}
