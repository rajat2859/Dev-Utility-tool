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

let avifEncodingSupportProbe: Promise<boolean> | null = null;

const isAvifEncodingSupported = (): Promise<boolean> => {
  avifEncodingSupportProbe ??= new Promise<boolean>((resolve) => {
    const probeCanvas = document.createElement('canvas');
    probeCanvas.width = 1;
    probeCanvas.height = 1;
    probeCanvas.toBlob((blob) => resolve(blob?.type === 'image/avif'), 'image/avif');
  });
  return avifEncodingSupportProbe;
};

const AVIF_WEBP_FALLBACK_MESSAGE = 'AVIF not supported by your browser; automatically compressed via WebP.';

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
          quality: MODE_QUALITIES[globalCompressionMode],
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
          quality: MODE_QUALITIES[globalCompressionMode],
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

  const convertToBlobWithBelow100kb = async (
    imgHtml: HTMLImageElement,
    mimeType: string,
    targetFormat: string,
    maxSizeBytes: number = 100 * 1024
  ): Promise<{ blob: Blob; finalQuality: number }> => {
    let scale = 1.0;
    let quality = 0.82;
    let bestBlob: Blob | null = null;
    let bestQuality = quality;
    let canvas: HTMLCanvasElement | null = null;
    let renderedScale = 0;

    for (let attempt = 1; attempt <= 7; attempt++) {
      if (!canvas || renderedScale !== scale) {
        const finalWidth = Math.max(1, Math.round(imgHtml.naturalWidth * scale));
        const finalHeight = Math.max(1, Math.round(imgHtml.naturalHeight * scale));
        canvas = document.createElement('canvas');
        canvas.width = finalWidth;
        canvas.height = finalHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) break;

        if (targetFormat === 'jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, finalWidth, finalHeight);
        }

        ctx.drawImage(imgHtml, 0, 0, finalWidth, finalHeight);
        renderedScale = scale;
      }

      const encodingCanvas = canvas;
      const blob = await new Promise<Blob | null>((resolveBlob) => {
        encodingCanvas.toBlob((b) => resolveBlob(b), mimeType, quality);
      });

      if (!blob) break;

      if (!bestBlob || blob.size < maxSizeBytes || (blob.size < bestBlob.size && bestBlob.size > maxSizeBytes)) {
        bestBlob = blob;
        bestQuality = quality;
      }

      if (blob.size < maxSizeBytes) {
        break;
      }

      if (quality > 0.6) {
        quality = 0.50;
      } else if (quality > 0.3) {
        quality = 0.25;
      } else if (quality > 0.12) {
        quality = 0.10;
      } else {
        scale = scale * 0.70;
        quality = 0.65;
      }

      if (scale < 0.05) {
        scale = 0.05;
        break;
      }
    }

    return {
      blob: bestBlob!,
      finalQuality: bestQuality,
    };
  };

  const convertSingleImage = async (imgFile: ImageFile): Promise<ImageFile> => {
    const avifFallsBackToWebp = imgFile.targetFormat === 'avif' && !(await isAvifEncodingSupported());
    const fallbackNotice = avifFallsBackToWebp ? AVIF_WEBP_FALLBACK_MESSAGE : undefined;

    return new Promise((resolve) => {
      if (imgFile.width === 0 || imgFile.height === 0) {
        resolve({
          ...imgFile,
          status: 'error',
          errorMessage: 'Cannot process invalid dimensions.'
        });
        return;
      }

      const imgHtml = new Image();
      imgHtml.onload = () => {
        try {
          const isBelow100kbTarget =
            imgFile.compressionMode === 'below100kb' &&
            (imgFile.targetFormat === 'webp' || imgFile.targetFormat === 'avif' || imgFile.targetFormat === 'jpeg');

          if (isBelow100kbTarget) {
            const effectiveFormat = avifFallsBackToWebp ? 'webp' : imgFile.targetFormat;
            const effectiveMimeType = effectiveFormat === 'jpeg' ? 'image/jpeg' : effectiveFormat === 'avif' ? 'image/avif' : 'image/webp';

            convertToBlobWithBelow100kb(imgHtml, effectiveMimeType, effectiveFormat)
              .then(({ blob, finalQuality }) => {
                if (blob) {
                  resolve({
                    ...imgFile,
                    status: 'completed',
                    convertedDataUrl: URL.createObjectURL(blob),
                    convertedSize: blob.size,
                    quality: finalQuality,
                    errorMessage: fallbackNotice
                  });
                } else {
                  resolve({
                    ...imgFile,
                    status: 'error',
                    errorMessage: 'Blob generation failed in Under 100 KB mode.'
                  });
                }
              })
              .catch((e: any) => {
                resolve({
                  ...imgFile,
                  status: 'error',
                  errorMessage: e.message || 'Error occurred during rendering.'
                });
              });
            return;
          }

          const canvas = document.createElement('canvas');
          const finalWidth = imgFile.width;
          const finalHeight = imgFile.height;
          canvas.width = finalWidth;
          canvas.height = finalHeight;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({
              ...imgFile,
              status: 'error',
              errorMessage: 'Could not create canvas context.'
            });
            return;
          }

          if (imgFile.targetFormat === 'jpeg') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, finalWidth, finalHeight);
          }

          ctx.drawImage(imgHtml, 0, 0, finalWidth, finalHeight);

          if (imgFile.targetFormat === 'svg') {
            if (imgFile.svgMode === 'trace') {
              const svgText = performSvgTrace(canvas, ctx);
              const blob = new Blob([svgText], { type: 'image/svg+xml' });
              const url = URL.createObjectURL(blob);
              resolve({
                ...imgFile,
                status: 'completed',
                convertedDataUrl: url,
                convertedSize: blob.size,
                svgCode: svgText
              });
            } else {
              const base64Url = canvas.toDataURL(imgFile.type || 'image/png');
              const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${finalWidth} ${finalHeight}" width="${finalWidth}" height="${finalHeight}">
  <image width="${finalWidth}" height="${finalHeight}" xlink:href="${base64Url}" />
</svg>`;
              const blob = new Blob([svgContent], { type: 'image/svg+xml' });
              const url = URL.createObjectURL(blob);
              resolve({
                ...imgFile,
                status: 'completed',
                convertedDataUrl: url,
                convertedSize: blob.size,
                svgCode: svgContent
              });
            }
          } else {
            let mimeType = 'image/png';
            if (imgFile.targetFormat === 'jpeg') mimeType = 'image/jpeg';
            if (imgFile.targetFormat === 'webp' || avifFallsBackToWebp) mimeType = 'image/webp';
            if (imgFile.targetFormat === 'avif' && !avifFallsBackToWebp) mimeType = 'image/avif';

            canvas.toBlob(
              (blob) => {
                if (blob) {
                  resolve({
                    ...imgFile,
                    status: 'completed',
                    convertedDataUrl: URL.createObjectURL(blob),
                    convertedSize: blob.size,
                    errorMessage: fallbackNotice
                  });
                } else {
                  resolve({
                    ...imgFile,
                    status: 'error',
                    errorMessage: 'Blob generation returned null.'
                  });
                }
              },
              mimeType,
              imgFile.quality
            );
          }
        } catch (e: any) {
          resolve({
            ...imgFile,
            status: 'error',
            errorMessage: e.message || 'Error occurred during rendering.'
          });
        }
      };

      imgHtml.onerror = () => {
        resolve({
          ...imgFile,
          status: 'error',
          errorMessage: 'Image could not be loaded into canvas.'
        });
      };

      imgHtml.src = imgFile.previewUrl;
    });
  };

  const handleConvertAll = async () => {
    await Promise.all(
      images.map(async (current) => {
        if (current.status === 'pending' || current.status === 'error' || current.status === 'processing') {
          const result = await convertSingleImage({ ...current, status: 'processing' });
          setImages((prev) => prev.map((img) => (img.id === result.id ? result : img)));
        }
      })
    );
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

    completed.forEach((img, idx) => {
      setTimeout(() => {
        triggerDownload(img);
      }, idx * 250);
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
