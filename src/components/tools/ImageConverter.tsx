import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Trash2, Download, RefreshCw, Check, AlertCircle, FileCode, Sliders, ChevronDown, Info, TrendingDown, TrendingUp, Minus, Sparkles, Zap, Copy, Code, X } from 'lucide-react';
import JSZip from 'jszip';

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
  scale: number; // multiplier e.g. 1.0
  svgMode: 'embed' | 'trace';
  compressionMode: 'below100kb' | 'balanced' | 'max_compress';
  status: 'pending' | 'processing' | 'completed' | 'error';
  convertedDataUrl?: string;
  convertedSize?: number;
  svgCode?: string;
  errorMessage?: string;
}

export default function ImageConverter() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [globalFormat, setGlobalFormat] = useState<'png' | 'jpeg' | 'webp' | 'svg' | 'avif'>('webp');
  const [globalCompressionMode, setGlobalCompressionMode] = useState<'below100kb' | 'balanced' | 'max_compress'>('balanced');
  const [globalQuality, setGlobalQuality] = useState<number>(82);
  const [globalSvgMode, setGlobalSvgMode] = useState<'embed' | 'trace'>('trace');
  const [activeSvgModal, setActiveSvgModal] = useState<{ name: string; code: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopySvgCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 2000);
  };

  const handleGlobalCompressionChange = (mode: 'below100kb' | 'balanced' | 'max_compress') => {
    setGlobalCompressionMode(mode);
    if (mode === 'below100kb') {
      setGlobalQuality(65);
    } else if (mode === 'balanced') {
      setGlobalQuality(82);
    } else if (mode === 'max_compress') {
      setGlobalQuality(55);
    }
  };

  useEffect(() => {
    if (globalFormat !== 'webp' && globalFormat !== 'avif' && globalCompressionMode === 'below100kb') {
      setGlobalCompressionMode('balanced');
      setGlobalQuality(82);
    }
  }, [globalFormat]);

  useEffect(() => {
    return () => {
      images.forEach((img) => {
        URL.revokeObjectURL(img.previewUrl);
        if (img.convertedDataUrl && img.convertedDataUrl.startsWith('blob:')) {
          URL.revokeObjectURL(img.convertedDataUrl);
        }
      });
    };
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFiles = (files: FileList) => {
    const validImageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    
    validImageFiles.forEach((file) => {
      const previewUrl = URL.createObjectURL(file);
      const img = new Image();
      
      img.onload = () => {
        const newImage: ImageFile = {
          id: Math.random().toString(36).substring(2, 9),
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          previewUrl,
          width: img.width,
          height: img.height,
          targetFormat: globalFormat,
          quality: globalCompressionMode === 'max_compress' ? 0.55 : globalCompressionMode === 'below100kb' ? 0.65 : 0.82,
          scale: 1,
          svgMode: globalSvgMode,
          compressionMode: globalCompressionMode,
          status: 'pending'
        };
        
        setImages((prev) => [...prev, newImage]);
      };
      
      img.onerror = () => {
        const newImage: ImageFile = {
          id: Math.random().toString(36).substring(2, 9),
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          previewUrl,
          width: 0,
          height: 0,
          targetFormat: globalFormat,
          quality: globalCompressionMode === 'max_compress' ? 0.55 : globalCompressionMode === 'below100kb' ? 0.65 : 0.82,
          scale: 1,
          svgMode: globalSvgMode,
          compressionMode: globalCompressionMode,
          status: 'error',
          errorMessage: 'Invalid image format or corrupted file.'
        };
        setImages((prev) => [...prev, newImage]);
      };

      img.src = previewUrl;
    });
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
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        if (target.convertedDataUrl && target.convertedDataUrl.startsWith('blob:')) {
          URL.revokeObjectURL(target.convertedDataUrl);
        }
      }
      return prev.filter((img) => img.id !== id);
    });
  };

  const clearAll = () => {
    images.forEach((img) => {
      URL.revokeObjectURL(img.previewUrl);
      if (img.convertedDataUrl && img.convertedDataUrl.startsWith('blob:')) {
        URL.revokeObjectURL(img.convertedDataUrl);
      }
    });
    setImages([]);
  };

  const applyGlobalConfig = () => {
    setImages((prev) =>
      prev.map((img) => ({
        ...img,
        targetFormat: globalFormat,
        compressionMode: globalCompressionMode,
        quality: globalCompressionMode === 'max_compress' ? 0.55 : globalCompressionMode === 'below100kb' ? 0.65 : 0.82,
        scale: 1,
        svgMode: globalSvgMode,
        status: 'pending',
        convertedDataUrl: undefined,
        convertedSize: undefined,
        errorMessage: undefined
      }))
    );
  };

  const updateIndividualImage = <K extends keyof ImageFile>(id: string, key: K, value: ImageFile[K]) => {
    setImages((prev) =>
      prev.map((img) => {
        if (img.id === id) {
          const updated = { ...img, [key]: value };
          if (key === 'targetFormat') {
            const fmt = value as ImageFile['targetFormat'];
            if (fmt !== 'webp' && fmt !== 'avif' && updated.compressionMode === 'below100kb') {
              updated.compressionMode = 'balanced';
              updated.quality = 0.82;
            }
          } else if (key === 'compressionMode') {
            const mode = value as ImageFile['compressionMode'];
            if (mode === 'below100kb') {
              updated.quality = 0.65;
            } else if (mode === 'balanced') {
              updated.quality = 0.82;
            } else if (mode === 'max_compress') {
              updated.quality = 0.55;
            }
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

  const performSvgTrace = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): string => {
    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    let pathD = '';
    const step = 4;
    
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const alpha = data[idx + 3];

        const luma = 0.299 * r + 0.587 * g + 0.114 * b;

        if (alpha > 128 && luma < 128) {
          pathD += `M${x},${y}h${step}v${step}h-${step}z `;
        }
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <path d="${pathD}" fill="#000000" />
</svg>`;
  };

let isAvifSupportedCached: boolean | null = null;
const checkAvifCanvasSupport = (): boolean => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (isAvifSupportedCached !== null) return isAvifSupportedCached;
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const data = c.toDataURL('image/avif');
    isAvifSupportedCached = data.startsWith('data:image/avif');
  } catch {
    isAvifSupportedCached = false;
  }
  return isAvifSupportedCached;
};

  const convertToBlobWithBelow100kb = async (
    imgHtml: HTMLImageElement,
    mimeType: string,
    initialScale: number,
    targetFormat: 'webp' | 'avif',
    maxSizeBytes: number = 98 * 1024
  ): Promise<{ blob: Blob; finalScale: number; finalQuality: number }> => {
    let currentMime = mimeType;
    if (targetFormat === 'avif' && !checkAvifCanvasSupport()) {
      currentMime = 'image/webp';
    }

    const naturalWidth = imgHtml.naturalWidth || imgHtml.width;
    const naturalHeight = imgHtml.naturalHeight || imgHtml.height;
    const naturalPixels = naturalWidth * naturalHeight;

    // Fast-path: Calculate exact safe initial pixel budget to avoid rendering oversized canvases
    // Target 85KB payload budget
    const targetPayloadBytes = 85 * 1024;
    const estimatedBpp = currentMime === 'image/avif' ? 0.055 : 0.078;
    const maxSafePixels = Math.round(targetPayloadBytes / estimatedBpp);

    let scale = Math.min(initialScale, Math.sqrt(maxSafePixels / naturalPixels));
    scale = Math.max(0.08, Math.min(1.0, scale));
    let quality = 0.80;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context could not be initialized.');
    }

    let bestBlob: Blob | null = null;
    let bestQuality = quality;

    // 1-2 fast iterations resolve >99% of images in milliseconds
    for (let attempt = 1; attempt <= 4; attempt++) {
      const finalWidth = Math.max(1, Math.round(naturalWidth * scale));
      const finalHeight = Math.max(1, Math.round(naturalHeight * scale));

      canvas.width = finalWidth;
      canvas.height = finalHeight;

      ctx.clearRect(0, 0, finalWidth, finalHeight);
      ctx.drawImage(imgHtml, 0, 0, finalWidth, finalHeight);

      const blob = await new Promise<Blob | null>((resolveBlob) => {
        canvas.toBlob((b) => resolveBlob(b), currentMime, quality);
      });

      if (!blob) break;

      // Handle browser claiming AVIF support but returning PNG fallback
      if (currentMime === 'image/avif' && blob.type === 'image/png') {
        currentMime = 'image/webp';
        continue;
      }

      if (blob.size <= maxSizeBytes) {
        return {
          blob,
          finalScale: scale,
          finalQuality: quality,
        };
      }

      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
        bestQuality = quality;
      }

      // Fast ratio scaling to land directly inside 80KB-92KB
      const targetRatio = (88 * 1024) / blob.size;
      const scaleMultiplier = Math.min(0.92, Math.sqrt(targetRatio));

      if (blob.size < 130 * 1024 && quality > 0.60) {
        quality = 0.50;
      } else {
        scale = Math.max(0.05, scale * scaleMultiplier);
        quality = Math.max(0.40, quality * 0.90);
      }
    }

    return {
      blob: bestBlob!,
      finalQuality: bestQuality,
    };
  };

  const convertSingleImage = async (imgFile: ImageFile): Promise<ImageFile> => {
    if (imgFile.width === 0 || imgFile.height === 0) {
      return {
        ...imgFile,
        status: 'error',
        errorMessage: 'Cannot process invalid dimensions.'
      };
    }

    const imgHtml = new Image();
    imgHtml.src = imgFile.previewUrl;

    try {
      if (typeof imgHtml.decode === 'function') {
        await imgHtml.decode();
      } else {
        await new Promise((res, rej) => {
          (imgHtml as HTMLImageElement).onload = () => res(true);
          (imgHtml as HTMLImageElement).onerror = rej;
        });
      }
    } catch {
      return {
        ...imgFile,
        status: 'error',
        errorMessage: 'Image could not be loaded into canvas.'
      };
    }

    try {
      const canvas = document.createElement('canvas');
      let effectiveScale = imgFile.scale || 1.0;
      if (imgFile.compressionMode === 'max_compress') {
        effectiveScale = 0.85;
      }
      let finalWidth = Math.max(1, Math.round(imgFile.width * effectiveScale));
      let finalHeight = Math.max(1, Math.round(imgFile.height * effectiveScale));
      if (imgFile.targetFormat === 'svg' && imgFile.svgMode === 'trace' && finalWidth > 1200) {
        finalHeight = Math.round(finalHeight * (1200 / finalWidth));
        finalWidth = 1200;
      }
      canvas.width = finalWidth;
      canvas.height = finalHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return {
          ...imgFile,
          status: 'error',
          errorMessage: 'Could not create canvas context.'
        };
      }

      if (imgFile.targetFormat === 'jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, finalWidth, finalHeight);
      }

      ctx.drawImage(imgHtml, 0, 0, finalWidth, finalHeight);

      if (imgFile.targetFormat === 'svg') {
        if (imgFile.svgMode === 'trace') {
          if (typeof (window as any).ImageTracer !== 'undefined') {
            const imgData = canvas.toDataURL('image/png');
            const svgText = await new Promise<string>((resolveTrace) => {
              (window as any).ImageTracer.imageToSVG(
                imgData,
                (resSvg: string) => resolveTrace(resSvg),
                { numberofcolors: 32, ltres: 1, qtres: 1, pathomit: 10 }
              );
            });
            const blob = new Blob([svgText], { type: 'image/svg+xml' });
            return {
              ...imgFile,
              status: 'completed',
              convertedDataUrl: URL.createObjectURL(blob),
              convertedSize: blob.size,
              svgCode: svgText
            };
          } else {
            const svgText = performSvgTrace(canvas, ctx);
            const blob = new Blob([svgText], { type: 'image/svg+xml' });
            return {
              ...imgFile,
              status: 'completed',
              convertedDataUrl: URL.createObjectURL(blob),
              convertedSize: blob.size,
              svgCode: svgText
            };
          }
        } else {
          const base64Url = canvas.toDataURL(imgFile.type || 'image/png');
          const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${finalWidth} ${finalHeight}" width="${finalWidth}" height="${finalHeight}">
  <image width="${finalWidth}" height="${finalHeight}" xlink:href="${base64Url}" />
</svg>`;
          const blob = new Blob([svgContent], { type: 'image/svg+xml' });
          return {
            ...imgFile,
            status: 'completed',
            convertedDataUrl: URL.createObjectURL(blob),
            convertedSize: blob.size,
            svgCode: svgContent
          };
        }
      }

      let mimeType = 'image/png';
      if (imgFile.targetFormat === 'jpeg') mimeType = 'image/jpeg';
      if (imgFile.targetFormat === 'webp') mimeType = 'image/webp';
      if (imgFile.targetFormat === 'avif') mimeType = 'image/avif';

      if (imgFile.compressionMode === 'below100kb' && (imgFile.targetFormat === 'webp' || imgFile.targetFormat === 'avif')) {
        const { blob, finalScale, finalQuality } = await convertToBlobWithBelow100kb(
          imgHtml,
          mimeType,
          imgFile.scale,
          imgFile.targetFormat
        );
        if (blob) {
          return {
            ...imgFile,
            status: 'completed',
            convertedDataUrl: URL.createObjectURL(blob),
            convertedSize: blob.size,
            scale: finalScale,
            quality: finalQuality
          };
        } else {
          return {
            ...imgFile,
            status: 'error',
            errorMessage: 'Blob generation failed in Under 100 KB mode.'
          };
        }
      }

      const targetQuality = imgFile.compressionMode === 'max_compress' ? 0.55 : 0.82;

      const blob = await new Promise<Blob | null>((resolveBlob) => {
        canvas.toBlob((b) => resolveBlob(b), mimeType, targetQuality);
      });

      if (!blob) {
        return {
          ...imgFile,
          status: 'error',
          errorMessage: 'Blob generation returned null.'
        };
      }

      if (imgFile.targetFormat === 'avif' && blob.type === 'image/png') {
        const fallbackBlob = await new Promise<Blob | null>((resolveFallback) => {
          canvas.toBlob((b) => resolveFallback(b), 'image/webp', targetQuality);
        });
        if (fallbackBlob) {
          return {
            ...imgFile,
            status: 'completed',
            convertedDataUrl: URL.createObjectURL(fallbackBlob),
            convertedSize: fallbackBlob.size,
            errorMessage: 'AVIF not supported by your browser; automatically compressed via WebP.'
          };
        }
      }

      return {
        ...imgFile,
        status: 'completed',
        convertedDataUrl: URL.createObjectURL(blob),
        convertedSize: blob.size
      };
    } catch (e: any) {
      return {
        ...imgFile,
        status: 'error',
        errorMessage: e.message || 'Error occurred during rendering.'
      };
    }
  };

  const handleConvertAll = async () => {
    setImages((prev) =>
      prev.map((img) =>
        img.status === 'pending' || img.status === 'error' ? { ...img, status: 'processing' } : img
      )
    );

    const convertedList = await Promise.all(
      images.map(async (current) => {
        if (current.status === 'pending' || current.status === 'error' || current.status === 'processing') {
          const res = await convertSingleImage({ ...current, status: 'processing' });
          setImages((prev) => prev.map((img) => (img.id === res.id ? res : img)));
          return res;
        }
        return current;
      })
    );

    setImages(convertedList);
  };

  const triggerDownload = (img: ImageFile) => {
    if (!img.convertedDataUrl) return;
    const link = document.createElement('a');
    link.href = img.convertedDataUrl;
    const baseName = img.name.substring(0, img.name.lastIndexOf('.')) || img.name;
    link.download = `${baseName}_converted.${img.targetFormat}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSingle = async (img: ImageFile) => {
    let activeImg = img;
    if (img.status === 'pending' || img.status === 'error') {
      setImages((prev) =>
        prev.map((itm) => (itm.id === img.id ? { ...itm, status: 'processing' } : itm))
      );
      const result = await convertSingleImage({ ...img, status: 'processing' });
      setImages((prev) =>
        prev.map((itm) => (itm.id === img.id ? result : itm))
      );
      activeImg = result;
    }
    
    if (activeImg.status === 'completed') {
      triggerDownload(activeImg);
    }
  };

  const handleDownloadAll = async () => {
    let listToProcess = [...images];
    const hasPendingOrError = listToProcess.some((img) => img.status === 'pending' || img.status === 'error');

    if (hasPendingOrError) {
      setImages((prev) =>
        prev.map((img) => (img.status === 'pending' || img.status === 'error' ? { ...img, status: 'processing' } : img))
      );

      listToProcess = await Promise.all(
        listToProcess.map((img) =>
          img.status === 'pending' || img.status === 'error' || img.status === 'processing'
            ? convertSingleImage({ ...img, status: 'processing' })
            : img
        )
      );
      setImages(listToProcess);
    }

    const completed = listToProcess.filter((img) => img.status === 'completed');
    if (completed.length === 0) return;

    if (completed.length > 5) {
      try {
        const zip = new JSZip();
        for (const img of completed) {
          if (img.convertedDataUrl) {
            const response = await fetch(img.convertedDataUrl);
            const blob = await response.blob();
            const baseName = img.name.substring(0, img.name.lastIndexOf('.')) || img.name;
            zip.file(`${baseName}_converted.${img.targetFormat}`, blob);
          }
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = `StudioBatch_${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error('Failed to create zip package, falling back to individual downloads', err);
        completed.forEach((img, idx) => {
          setTimeout(() => {
            triggerDownload(img);
          }, idx * 250);
        });
      }
    } else {
      completed.forEach((img, idx) => {
        setTimeout(() => {
          triggerDownload(img);
        }, idx * 250);
      });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getProjectedSize = (img: ImageFile): number => {
    if (!img.size || img.size === 0) return 0;
    if (img.width === 0 || img.height === 0) return img.size;

    const originalPixels = img.width * img.height;
    let effectiveScale = 1.0;
    if (img.compressionMode === 'max_compress') {
      effectiveScale = 0.85;
    }
    const targetScale = (img.scale || 1.0) * effectiveScale;
    const targetPixels = Math.round(originalPixels * targetScale * targetScale);

    const isSourcePng = img.type.includes('png');
    const isSourceJpeg = img.type.includes('jpeg') || img.type.includes('jpg');
    const isSourceWebp = img.type.includes('webp');
    const isSourceAvif = img.type.includes('avif');

    // If exact same format with ~100% quality and 1.0 scale, return original size
    const isSameFormat =
      (img.targetFormat === 'png' && isSourcePng) ||
      (img.targetFormat === 'jpeg' && isSourceJpeg) ||
      (img.targetFormat === 'webp' && isSourceWebp) ||
      (img.targetFormat === 'avif' && isSourceAvif);

    if (isSameFormat && targetScale === 1.0 && img.quality >= 0.98) {
      return img.size;
    }

    // Determine visual entropy / complexity factor based on original image density
    const sourceBpp = img.size / originalPixels;
    // 0.18 bytes per pixel is standard photographic baseline
    const complexityFactor = Math.min(Math.max(sourceBpp / 0.18, 0.40), 2.5);

    // Non-linear quality curve: Balanced uses 0.82 (visually lossless), Max Compress uses 0.55
    const targetQuality = img.compressionMode === 'max_compress' ? 0.55 : 0.82;
    let qualityCurve = 1.0;
    if (targetQuality <= 0.82) {
      qualityCurve = 0.15 + 0.85 * Math.pow(targetQuality / 0.82, 1.6);
    } else {
      qualityCurve = 1.0 + 2.8 * Math.pow((targetQuality - 0.82) / 0.18, 1.7);
    }

    // Check effective target format (handling AVIF browser fallback to WebP)
    const effectiveTargetFormat = (img.targetFormat === 'avif' && !checkAvifCanvasSupport()) ? 'webp' : img.targetFormat;

    let projectedBytes = img.size;

    if (img.compressionMode === 'below100kb' && (effectiveTargetFormat === 'webp' || effectiveTargetFormat === 'avif')) {
      const estimatedUnconstrained = targetPixels * (effectiveTargetFormat === 'avif' ? 0.055 : 0.085) * complexityFactor;
      if (estimatedUnconstrained <= 90 * 1024) {
        projectedBytes = Math.max(Math.round(estimatedUnconstrained), 12 * 1024);
      } else {
        projectedBytes = 86 * 1024;
      }
    } else if (effectiveTargetFormat === 'png') {
      if (isSourcePng && targetScale === 1.0) {
        projectedBytes = img.size;
      } else if (isSourcePng) {
        projectedBytes = img.size * Math.pow(targetScale, 1.85);
      } else {
        // PNG is uncompressed RGB deflate: 0.75 - 1.25 bytes/pixel
        const estimatedPngBpp = Math.min(Math.max(0.78 * complexityFactor, 0.45), 1.6);
        projectedBytes = targetPixels * estimatedPngBpp;
      }
    } else if (effectiveTargetFormat === 'webp') {
      // Canvas WebP encoder outputs ~0.085 bytes/pixel at Q=0.82
      const baseWebpBpp = 0.085 * complexityFactor;
      projectedBytes = targetPixels * baseWebpBpp * qualityCurve;
    } else if (effectiveTargetFormat === 'avif') {
      // Canvas AVIF encoder outputs ~0.055 bytes/pixel at Q=0.82
      const baseAvifBpp = 0.055 * complexityFactor;
      projectedBytes = targetPixels * baseAvifBpp * qualityCurve;
    } else if (effectiveTargetFormat === 'jpeg') {
      // Canvas JPEG encoder outputs ~0.115 bytes/pixel at Q=0.82
      const baseJpegBpp = 0.115 * complexityFactor;
      projectedBytes = targetPixels * baseJpegBpp * qualityCurve;
    } else if (effectiveTargetFormat === 'svg') {
      if (img.svgMode === 'trace') {
        const traceW = Math.min(img.width * targetScale, 1200);
        const traceH = (img.height * targetScale) * (traceW / (img.width * targetScale || 1));
        const tracePixels = traceW * traceH;
        projectedBytes = Math.min(Math.max(tracePixels * 0.045 * complexityFactor + 6000, 15000), 280000);
      } else {
        const estimatedRasterSize = targetPixels * Math.max(0.55 * complexityFactor, 0.35);
        projectedBytes = estimatedRasterSize * 1.35 + 400;
      }
    }

    return Math.max(Math.round(projectedBytes), 800);
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 flex items-center justify-between">
              <span>Target Output Format</span>
              <span className="text-[10px] font-mono font-semibold text-slate-900 uppercase">{globalFormat}</span>
            </label>
            <div className="relative">
              <select
                value={globalFormat}
                onChange={(e) => setGlobalFormat(e.target.value as any)}
                className="w-full text-xs font-medium rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer shadow-xs"
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
                className="w-full text-xs font-medium rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer shadow-xs"
              >
                {(globalFormat === 'webp' || globalFormat === 'avif') && (
                  <option value="below100kb">Less than 100 KB</option>
                )}
                <option value="balanced">Balanced (Visually Lossless)</option>
                <option value="max_compress">Max Compress</option>
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
                  className={`py-1.5 text-xs font-medium rounded cursor-pointer ${
                    globalSvgMode === 'embed' ? 'bg-white shadow-xs text-slate-900 font-semibold' : 'text-slate-500'
                  }`}
                >
                  Embed
                </button>
                <button
                  type="button"
                  onClick={() => setGlobalSvgMode('trace')}
                  className={`py-1.5 text-xs font-medium rounded cursor-pointer ${
                    globalSvgMode === 'trace' ? 'bg-white shadow-xs text-slate-900 font-semibold' : 'text-slate-500'
                  }`}
                >
                  Trace
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-end">
              <button
                onClick={applyGlobalConfig}
                disabled={images.length === 0}
                className="w-full text-xs font-medium py-2 px-3 bg-blue-600 text-white hover:bg-blue-700 rounded-md shadow-xs cursor-pointer transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                Apply to Queue
              </button>
            </div>
          )}
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
          quality: globalCompressionMode === 'max_compress' ? 0.55 : globalCompressionMode === 'below100kb' ? 0.65 : 0.82,
          scale: 1,
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
                <div className="flex items-center gap-3 min-w-[220px] max-w-sm">
                  <div className="h-12 w-12 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-100 flex items-center justify-center relative">
                    <img
                      src={img.previewUrl}
                      alt={img.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
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

                {/* Settings Block for this item */}
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">Format</span>
                    <select
                      value={img.targetFormat}
                      onChange={(e) => updateIndividualImage(img.id, 'targetFormat', e.target.value as any)}
                      className="text-xs font-medium rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-900 focus:ring-2 focus:ring-blue-500/50 shadow-xs"
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
                      className="text-xs font-medium rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-900 focus:ring-2 focus:ring-blue-500/50 shadow-xs"
                    >
                      {(img.targetFormat === 'webp' || img.targetFormat === 'avif') && (
                        <option value="below100kb">Less than 100 KB</option>
                      )}
                      <option value="balanced">Balanced</option>
                      <option value="max_compress">Max Compress</option>
                    </select>
                  </div>
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-3 shrink-0 justify-end">
                  <div className="text-right">
                    {img.status === 'pending' && (
                      <span className="text-xs font-mono text-slate-400">
                        ~{formatBytes(getProjectedSize(img))}
                      </span>
                    )}
                    {img.status === 'processing' && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-900 font-medium">
                        <RefreshCw className="h-3 w-3 animate-spin text-slate-900" />
                        Converting...
                      </span>
                    )}
                    {img.status === 'completed' && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold">
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

                  <div className="flex items-center gap-1">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileCode className="h-4 w-4 text-blue-600" />
                <h3 className="text-xs font-semibold text-slate-900 truncate max-w-md">SVG Source Code: {activeSvgModal.name}</h3>
              </div>
              <button
                onClick={() => setActiveSvgModal(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200/60 cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-auto bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed select-all">
              <pre className="whitespace-pre-wrap break-all">{activeSvgModal.code}</pre>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">
                {activeSvgModal.code.length.toLocaleString()} characters ({formatBytes(activeSvgModal.code.length)})
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(activeSvgModal.code);
                    setCopiedId('modal');
                    setTimeout(() => setCopiedId(null), 2000);
                  }}
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
            • <strong className="text-slate-900">SVG</strong> exports both vector XML markup for instant copy/paste and clean downloadable vector graphics.
          </p>
        </div>
      </div>
    </div>
  );
}
