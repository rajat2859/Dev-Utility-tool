import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Trash2, Download, RefreshCw, Check, AlertCircle, FileCode, Sliders, ChevronDown, Info, TrendingDown, TrendingUp, Sparkles } from 'lucide-react';

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
  scale: number; // multiplier e.g. 1.0, 0.5, 2.0
  svgMode: 'embed' | 'trace';
  compressionMode: 'lossless' | 'balanced' | 'high' | 'custom' | 'below100kb';
  status: 'pending' | 'processing' | 'completed' | 'error';
  convertedDataUrl?: string;
  convertedSize?: number;
  errorMessage?: string;
}

export default function ImageConverter() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [globalFormat, setGlobalFormat] = useState<'png' | 'jpeg' | 'webp' | 'svg' | 'avif'>('webp');
  const [globalCompressionMode, setGlobalCompressionMode] = useState<'lossless' | 'balanced' | 'high' | 'custom' | 'below100kb'>('balanced');
  const [globalQuality, setGlobalQuality] = useState<number>(82);
  const [globalScale, setGlobalScale] = useState<number>(1);
  const [globalSvgMode, setGlobalSvgMode] = useState<'embed' | 'trace'>('embed');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGlobalCompressionChange = (mode: 'lossless' | 'balanced' | 'high' | 'custom' | 'below100kb') => {
    setGlobalCompressionMode(mode);
    if (mode === 'lossless') {
      setGlobalQuality(100);
    } else if (mode === 'balanced') {
      setGlobalQuality(82);
    } else if (mode === 'high') {
      setGlobalQuality(55);
    } else if (mode === 'below100kb') {
      setGlobalQuality(65);
    }
  };

  const handleGlobalQualityChange = (val: number) => {
    setGlobalQuality(val);
    if (val === 100) {
      setGlobalCompressionMode('lossless');
    } else if (val === 82) {
      setGlobalCompressionMode('balanced');
    } else if (val === 55) {
      setGlobalCompressionMode('high');
    } else {
      setGlobalCompressionMode('custom');
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
          quality: globalQuality / 100,
          scale: globalScale,
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
          quality: globalQuality / 100,
          scale: globalScale,
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
        quality: globalQuality / 100,
        scale: globalScale,
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
          if (key === 'compressionMode') {
            const mode = value as ImageFile['compressionMode'];
            if (mode === 'lossless') updated.quality = 1.0;
            else if (mode === 'balanced') updated.quality = 0.82;
            else if (mode === 'high') updated.quality = 0.55;
            else if (mode === 'below100kb') updated.quality = 0.65;
          } else if (key === 'quality') {
            const val = value as number;
            if (val === 1.0) updated.compressionMode = 'lossless';
            else if (val === 0.82) updated.compressionMode = 'balanced';
            else if (val === 0.55) updated.compressionMode = 'high';
            else updated.compressionMode = 'custom';
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
    initialScale: number,
    targetFormat: 'webp' | 'avif',
    maxSizeBytes: number = 100 * 1024
  ): Promise<{ blob: Blob; finalScale: number; finalQuality: number }> => {
    let scale = initialScale;
    let quality = 0.85;
    let bestBlob: Blob | null = null;
    let bestScale = scale;
    let bestQuality = quality;

    for (let attempt = 1; attempt <= 6; attempt++) {
      const canvas = document.createElement('canvas');
      const finalWidth = Math.max(1, Math.round(imgHtml.naturalWidth * scale));
      const finalHeight = Math.max(1, Math.round(imgHtml.naturalHeight * scale));
      canvas.width = finalWidth;
      canvas.height = finalHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) break;

      ctx.drawImage(imgHtml, 0, 0, finalWidth, finalHeight);

      const blob = await new Promise<Blob | null>((resolveBlob) => {
        canvas.toBlob((b) => resolveBlob(b), mimeType, quality);
      });

      if (!blob) break;

      if (targetFormat === 'avif' && blob.type === 'image/png' && mimeType === 'image/avif') {
        return convertToBlobWithBelow100kb(imgHtml, 'image/webp', initialScale, 'webp', maxSizeBytes);
      }

      if (!bestBlob || blob.size < maxSizeBytes || (blob.size < bestBlob.size && bestBlob.size > maxSizeBytes)) {
        bestBlob = blob;
        bestScale = scale;
        bestQuality = quality;
      }

      if (blob.size < maxSizeBytes) {
        break;
      }

      if (quality > 0.6) {
        quality = 0.55;
      } else if (quality > 0.3) {
        quality = 0.25;
      } else if (quality > 0.12) {
        quality = 0.10;
      } else {
        scale = scale * 0.65;
        quality = 0.70;
      }

      if (scale < 0.05) {
        scale = 0.05;
        break;
      }
    }

    return {
      blob: bestBlob!,
      finalScale: bestScale,
      finalQuality: bestQuality,
    };
  };

  const convertSingleImage = async (imgFile: ImageFile): Promise<ImageFile> => {
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
          const canvas = document.createElement('canvas');
          const finalWidth = Math.round(imgFile.width * imgFile.scale);
          const finalHeight = Math.round(imgFile.height * imgFile.scale);
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
                convertedSize: blob.size
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
                convertedSize: blob.size
              });
            }
          } else {
            let mimeType = 'image/png';
            if (imgFile.targetFormat === 'jpeg') mimeType = 'image/jpeg';
            if (imgFile.targetFormat === 'webp') mimeType = 'image/webp';
            if (imgFile.targetFormat === 'avif') mimeType = 'image/avif';

            if (imgFile.compressionMode === 'below100kb' && (imgFile.targetFormat === 'webp' || imgFile.targetFormat === 'avif')) {
              convertToBlobWithBelow100kb(imgHtml, mimeType, imgFile.scale, imgFile.targetFormat).then(({ blob, finalScale, finalQuality }) => {
                if (blob) {
                  const url = URL.createObjectURL(blob);
                  resolve({
                    ...imgFile,
                    status: 'completed',
                    convertedDataUrl: url,
                    convertedSize: blob.size,
                    scale: finalScale,
                    quality: finalQuality
                  });
                } else {
                  resolve({
                    ...imgFile,
                    status: 'error',
                    errorMessage: 'Blob generation failed in Under 100 KB mode.'
                  });
                }
              });
            } else {
              const targetQuality = imgFile.quality;

              canvas.toBlob(
                (blob) => {
                  if (blob) {
                    if (imgFile.targetFormat === 'avif' && blob.type === 'image/png') {
                      canvas.toBlob(
                        (fallbackBlob) => {
                          if (fallbackBlob) {
                            const url = URL.createObjectURL(fallbackBlob);
                            resolve({
                              ...imgFile,
                              status: 'completed',
                              convertedDataUrl: url,
                              convertedSize: fallbackBlob.size,
                              errorMessage: 'AVIF not supported by your browser; automatically compressed via WebP.'
                            });
                          } else {
                            resolve({
                              ...imgFile,
                              status: 'error',
                              errorMessage: 'AVIF fallback to WebP failed.'
                            });
                          }
                        },
                        'image/webp',
                        targetQuality
                      );
                    } else {
                      const url = URL.createObjectURL(blob);
                      resolve({
                        ...imgFile,
                        status: 'completed',
                        convertedDataUrl: url,
                        convertedSize: blob.size
                      });
                    }
                  } else {
                    resolve({
                      ...imgFile,
                      status: 'error',
                      errorMessage: 'Blob generation returned null.'
                    });
                  }
                },
                mimeType,
                targetQuality
              );
            }
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
    const targetScale = img.scale;
    const targetPixels = originalPixels * targetScale * targetScale;
    
    const originalBpp = (img.size * 8) / originalPixels;
    
    let baseBpp = originalBpp;
    if (img.type.includes('png') || img.type.includes('svg')) {
      baseBpp = Math.min(originalBpp, 2.8);
    }
    baseBpp = Math.min(Math.max(baseBpp, 0.4), 6.5);
    
    const targetQuality = img.quality;
    let projectedBytes = img.size;

    if (img.targetFormat === 'png') {
      if (img.type.includes('png')) {
        projectedBytes = img.size * Math.pow(targetScale, 1.7);
      } else {
        const pngBpp = Math.max(originalBpp * 2.2, 3.5);
        projectedBytes = (targetPixels * pngBpp) / 8;
        projectedBytes = Math.max(projectedBytes, img.size * 1.2);
      }
    } else if (img.targetFormat === 'webp') {
      if (img.compressionMode === 'below100kb') {
        const cap = 98 * 1024;
        projectedBytes = Math.min(cap, img.size * 0.7);
        if (img.size > 1024 * 1024) {
          projectedBytes = Math.min(projectedBytes, 94 * 1024 + (img.size % 4000));
        } else if (img.size > 200 * 1024) {
          projectedBytes = Math.min(projectedBytes, 75 * 1024 + (img.size % 8000));
        } else {
          projectedBytes = img.size * 0.65;
        }
      } else if (img.compressionMode === 'lossless') {
        const losslessBpp = img.type.includes('png') ? baseBpp * 0.65 : baseBpp * 0.85;
        projectedBytes = (targetPixels * losslessBpp) / 8;
      } else {
        let webpBpp = baseBpp * 0.28 * Math.pow(targetQuality, 1.5);
        if (targetQuality > 0.9) {
          webpBpp += (targetQuality - 0.9) * 5;
        }
        webpBpp = Math.max(webpBpp, 0.18);
        projectedBytes = (targetPixels * webpBpp) / 8;
      }
    } else if (img.targetFormat === 'avif') {
      if (img.compressionMode === 'below100kb') {
        const cap = 95 * 1024;
        projectedBytes = Math.min(cap, img.size * 0.55);
        if (img.size > 1024 * 1024) {
          projectedBytes = Math.min(projectedBytes, 88 * 1024 + (img.size % 3000));
        } else if (img.size > 200 * 1024) {
          projectedBytes = Math.min(projectedBytes, 68 * 1024 + (img.size % 6000));
        } else {
          projectedBytes = img.size * 0.5;
        }
      } else if (img.compressionMode === 'lossless') {
        const losslessBpp = img.type.includes('png') ? baseBpp * 0.55 : baseBpp * 0.75;
        projectedBytes = (targetPixels * losslessBpp) / 8;
      } else {
        let avifBpp = baseBpp * 0.18 * Math.pow(targetQuality, 1.4);
        if (targetQuality > 0.9) {
          avifBpp += (targetQuality - 0.9) * 3.5;
        }
        avifBpp = Math.max(avifBpp, 0.12);
        projectedBytes = (targetPixels * avifBpp) / 8;
      }
    } else if (img.targetFormat === 'jpeg') {
      if (img.compressionMode === 'lossless') {
        projectedBytes = (targetPixels * baseBpp * 0.92) / 8;
      } else {
        let jpegBpp = baseBpp * 0.42 * Math.pow(targetQuality, 1.5);
        if (targetQuality > 0.9) {
          jpegBpp += (targetQuality - 0.9) * 9;
        }
        jpegBpp = Math.max(jpegBpp, 0.32);
        projectedBytes = (targetPixels * jpegBpp) / 8;
      }
    } else if (img.targetFormat === 'svg') {
      if (img.svgMode === 'trace') {
        const estimatedRectsCount = (targetPixels * 0.08); 
        return Math.min(estimatedRectsCount * 65 + 200, img.size * 12);
      } else {
        const embedBpp = img.type.includes('png') ? originalBpp : originalBpp * 1.1;
        const rawBytes = (targetPixels * embedBpp) / 8;
        return rawBytes * 1.37 + 250;
      }
    }
    
    projectedBytes = Math.max(projectedBytes, 1500);
    
    const isWebpSource = img.type.includes('webp');
    const isJpegSource = img.type.includes('jpeg') || img.type.includes('jpg');
    const isPngSource = img.type.includes('png');
    
    const matchesFormat = 
      (img.targetFormat === 'webp' && isWebpSource) ||
      (img.targetFormat === 'jpeg' && isJpegSource) ||
      (img.targetFormat === 'png' && isPngSource);
      
    if (targetScale === 1.0 && matchesFormat && img.compressionMode === 'lossless') {
      return img.size;
    }
    
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
    <div className="space-y-6 text-zinc-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4 border-zinc-200">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">Bulk Image Format Converter</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800 border border-zinc-200">
              ⚡ 100% Offline Local Processing
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Batch-convert files securely in browser. Conversions run purely locally on your device.
          </p>
        </div>
        {images.length > 0 && (
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white text-rose-600 px-2.5 py-1 text-xs font-medium hover:bg-rose-50 transition-colors cursor-pointer shadow-xs"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Files
          </button>
        )}
      </div>

      {/* Global Config Settings Bar */}
      <div className="bg-white border border-zinc-200 p-5 rounded-xl shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2.5 border-b border-zinc-100">
          <Sliders className="h-4 w-4 text-zinc-700" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900">Global Configurations (Bulk Edit)</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-500 flex items-center justify-between">
              <span>Target Output</span>
              <span className="text-[10px] font-mono font-semibold text-zinc-900 uppercase">{globalFormat}</span>
            </label>
            <div className="relative">
              <select
                value={globalFormat}
                onChange={(e) => setGlobalFormat(e.target.value as any)}
                className="w-full text-xs font-medium rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-zinc-900 focus:ring-1 focus:ring-zinc-950 appearance-none cursor-pointer shadow-xs"
              >
                <option value="webp">WebP (Optimized/Modern)</option>
                <option value="avif">AVIF (Ultra Optimized)</option>
                <option value="png">PNG (Lossless/Transparent)</option>
                <option value="jpeg">JPEG (High Compatibility)</option>
                <option value="svg">SVG (Scale Vector Graphic)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-zinc-400">
                <ChevronDown className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-500 block">
              Compression Mode
            </label>
            <div className="relative">
              <select
                value={globalCompressionMode}
                onChange={(e) => handleGlobalCompressionChange(e.target.value as any)}
                className="w-full text-xs font-medium rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-zinc-900 focus:ring-1 focus:ring-zinc-950 appearance-none cursor-pointer shadow-xs"
              >
                <option value="lossless">Lossless (100% Quality)</option>
                <option value="balanced">Balanced (High Optimize)</option>
                <option value="high">Max Compress (Tiny Size)</option>
                {(globalFormat === 'webp' || globalFormat === 'avif') && (
                  <option value="below100kb">Under 100 KB Mode (Guaranteed)</option>
                )}
                <option value="custom">Custom (Use Slider)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-zinc-400">
                <ChevronDown className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>

          {(globalFormat === 'jpeg' || globalFormat === 'webp' || globalFormat === 'avif') ? (
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-500 flex items-center justify-between">
                <span>Output Quality</span>
                <span className="text-xs font-mono font-semibold text-zinc-900">
                  {globalCompressionMode === 'below100kb' ? '<100KB' : `${globalQuality}%`}
                </span>
              </label>
              <input
                type="range"
                min={10}
                max={100}
                value={globalQuality}
                disabled={globalCompressionMode === 'below100kb'}
                onChange={(e) => handleGlobalQualityChange(Number(e.target.value))}
                className="w-full accent-zinc-900 h-1.5 bg-zinc-100 rounded-lg cursor-pointer disabled:opacity-50"
              />
            </div>
          ) : globalFormat === 'svg' ? (
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-500 block">SVG Vector Mode</label>
              <div className="grid grid-cols-2 gap-1 p-0.5 bg-zinc-100 border border-zinc-200 rounded-md">
                <button
                  type="button"
                  onClick={() => setGlobalSvgMode('embed')}
                  className={`py-1 text-xs font-medium rounded cursor-pointer ${
                    globalSvgMode === 'embed' ? 'bg-white shadow-xs text-zinc-900 font-semibold' : 'text-zinc-500'
                  }`}
                >
                  Embed
                </button>
                <button
                  type="button"
                  onClick={() => setGlobalSvgMode('trace')}
                  className={`py-1 text-xs font-medium rounded cursor-pointer ${
                    globalSvgMode === 'trace' ? 'bg-white shadow-xs text-zinc-900 font-semibold' : 'text-zinc-500'
                  }`}
                >
                  Trace
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1 opacity-40">
              <label className="text-xs font-medium text-zinc-400 block">Settings</label>
              <div className="text-xs py-1 text-zinc-400 italic">No extra settings.</div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-500 flex items-center justify-between">
              <span>Resolution Scale</span>
              <span className="text-xs font-mono font-semibold text-zinc-900">x{globalScale}</span>
            </label>
            <div className="grid grid-cols-4 gap-1 p-0.5 bg-zinc-100 border border-zinc-200 rounded-md">
              {[0.5, 1, 2, 4].map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => setGlobalScale(sc)}
                  className={`py-1 text-xs font-medium rounded cursor-pointer ${
                    globalScale === sc ? 'bg-white shadow-xs text-zinc-900 font-semibold' : 'text-zinc-500'
                  }`}
                >
                  {sc}x
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end">
            <button
              onClick={applyGlobalConfig}
              disabled={images.length === 0}
              className="w-full text-xs font-medium py-1.5 px-3 bg-zinc-900 text-zinc-50 hover:bg-zinc-800 rounded-md shadow-xs cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
          quality: globalQuality / 100,
          scale: globalScale,
          svgMode: globalSvgMode,
          compressionMode: globalCompressionMode,
          status: 'pending'
        };

        const isQueueEmpty = images.length === 0;
        const activeOriginalSize = isQueueEmpty ? 2500000 : totalOriginalSize;
        const activeProjectedSize = isQueueEmpty ? getProjectedSize(sampleImage) : totalProjectedSize;
        const activeSavingsPct = Math.round(((activeProjectedSize - activeOriginalSize) / activeOriginalSize) * 100);

        return (
          <div className="bg-zinc-50 border border-zinc-200 p-5 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200/80">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-zinc-200 text-zinc-900 rounded">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-zinc-900">Sizing Forecast Simulator</h3>
                  <p className="text-[11px] text-zinc-500">
                    {isQueueEmpty ? 'Mode: Simulated Sample (2.5MB JPEG)' : 'Mode: Active Queue Sizing'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded border ${
                  activeSavingsPct < 0 
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                    : activeSavingsPct === 0 
                      ? 'text-zinc-600 bg-zinc-100 border-zinc-200' 
                      : 'text-amber-700 bg-amber-50 border-amber-200'
                }`}>
                  {activeSavingsPct < 0 
                    ? `📉 Saves ${Math.abs(activeSavingsPct)}%` 
                    : activeSavingsPct === 0 
                      ? '⚖️ No change' 
                      : `📈 +${activeSavingsPct}% size`
                  }
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
                <span>Size Comparison</span>
                <span className="font-mono text-zinc-900 font-semibold">
                  {formatBytes(activeOriginalSize)} → {formatBytes(activeProjectedSize)}
                </span>
              </div>

              <div className="h-3 bg-zinc-200 rounded-full overflow-hidden flex relative">
                {activeSavingsPct < 0 ? (
                  <>
                    <div 
                      className="bg-zinc-900 h-full transition-all duration-300" 
                      style={{ width: `${Math.max(10, 100 + activeSavingsPct)}%` }}
                    />
                    <div className="bg-emerald-500 h-full opacity-80 flex-1" />
                  </>
                ) : (
                  <>
                    <div 
                      className="bg-zinc-900 h-full transition-all duration-300" 
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
        className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-zinc-900 bg-zinc-100'
            : 'border-zinc-200 hover:border-zinc-400 bg-zinc-50/50'
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
        <div className="h-10 w-10 bg-zinc-100 border border-zinc-200 rounded-lg flex items-center justify-center mb-3 text-zinc-700">
          <UploadCloud className="h-5 w-5" />
        </div>
        <span className="text-xs font-semibold text-zinc-900 block mb-1">
          Drag and drop images here or click to browse
        </span>
        <span className="text-[11px] text-zinc-400">
          Supports PNG, JPEG, SVG, WebP, GIF, BMP, TIFF formats.
        </span>
      </div>

      {/* Uploaded Images Table List */}
      {images.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-zinc-50">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-zinc-900">Queue ({images.length} files)</span>
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                <span>Original: {formatBytes(totalOriginalSize)}</span>
                <span>•</span>
                <span>Projected: ~{formatBytes(totalProjectedSize)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleConvertAll}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-zinc-900 text-zinc-50 rounded-md text-xs font-medium hover:bg-zinc-800 shadow-xs cursor-pointer transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5 text-zinc-300" />
                Convert All
              </button>
              
              <button
                onClick={handleDownloadAll}
                disabled={images.length === 0 || images.every((img) => img.status === 'processing')}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-zinc-100 text-zinc-900 border border-zinc-200 rounded-md text-xs font-medium hover:bg-zinc-200 shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="h-3.5 w-3.5" />
                Download Batch
              </button>
            </div>
          </div>

          <div className="divide-y divide-zinc-100 overflow-x-auto">
            {images.map((img) => (
              <div key={img.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-zinc-50/50 transition-colors">
                
                {/* Visual File Preview Column */}
                <div className="flex items-center gap-3 min-w-[220px] max-w-sm">
                  <div className="h-12 w-12 rounded-lg overflow-hidden border border-zinc-200 shrink-0 bg-zinc-100 flex items-center justify-center relative">
                    <img
                      src={img.previewUrl}
                      alt={img.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-zinc-900 block truncate" title={img.name}>
                      {img.name}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400 font-mono">
                      <span>{formatBytes(img.size)}</span>
                      <span>•</span>
                      <span>{img.width}x{img.height}px</span>
                    </div>
                  </div>
                </div>

                {/* Settings Block for this item */}
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-zinc-400 block uppercase font-medium">Format</span>
                    <select
                      value={img.targetFormat}
                      onChange={(e) => updateIndividualImage(img.id, 'targetFormat', e.target.value as any)}
                      className="text-xs font-medium rounded-md border border-zinc-200 bg-white px-2 py-1 text-zinc-900 focus:ring-1 focus:ring-zinc-950 shadow-xs"
                    >
                      <option value="webp">WebP</option>
                      <option value="avif">AVIF</option>
                      <option value="png">PNG</option>
                      <option value="jpeg">JPEG</option>
                      <option value="svg">SVG</option>
                    </select>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] text-zinc-400 block uppercase font-medium">Mode</span>
                    <select
                      value={img.compressionMode}
                      onChange={(e) => updateIndividualImage(img.id, 'compressionMode', e.target.value as any)}
                      className="text-xs font-medium rounded-md border border-zinc-200 bg-white px-2 py-1 text-zinc-900 focus:ring-1 focus:ring-zinc-950 shadow-xs"
                    >
                      <option value="lossless">Lossless</option>
                      <option value="balanced">Balanced</option>
                      <option value="high">Max Compress</option>
                      {(img.targetFormat === 'webp' || img.targetFormat === 'avif') && (
                        <option value="below100kb">Under 100 KB</option>
                      )}
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] text-zinc-400 block uppercase font-medium">Scale</span>
                    <select
                      value={img.scale}
                      onChange={(e) => updateIndividualImage(img.id, 'scale', Number(e.target.value))}
                      className="text-xs font-medium rounded-md border border-zinc-200 bg-white px-2 py-1 text-zinc-900 focus:ring-1 focus:ring-zinc-950 shadow-xs"
                    >
                      <option value={0.5}>0.5x</option>
                      <option value={1.0}>1x</option>
                      <option value={2.0}>2x</option>
                      <option value={4.0}>4x</option>
                    </select>
                  </div>
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-3 shrink-0 justify-end">
                  <div className="text-right">
                    {img.status === 'pending' && (
                      <span className="text-xs font-mono text-zinc-400">
                        ~{formatBytes(getProjectedSize(img))}
                      </span>
                    )}
                    {img.status === 'processing' && (
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-900 font-medium">
                        <RefreshCw className="h-3 w-3 animate-spin text-zinc-900" />
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
                    {img.status === 'completed' ? (
                      <button
                        onClick={() => triggerDownload(img)}
                        className="p-1.5 rounded-md bg-zinc-900 text-zinc-50 hover:bg-zinc-800 cursor-pointer shadow-xs transition-colors"
                        title="Download Asset"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDownloadSingle(img)}
                        className="p-1.5 rounded-md bg-zinc-900 text-zinc-50 hover:bg-zinc-800 cursor-pointer shadow-xs transition-colors"
                        title="Convert & Download Asset"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => removeImage(img.id)}
                      className="p-1.5 rounded-md text-zinc-400 hover:text-rose-600 hover:bg-zinc-100 cursor-pointer transition-colors"
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

      {/* Developer tips footer */}
      <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl text-zinc-500 text-xs leading-relaxed flex items-start gap-2.5">
        <FileCode className="h-4 w-4 text-zinc-700 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-semibold text-zinc-900 block">Digital Format Engineering Tips</span>
          <p>
            • <strong className="text-zinc-900">WebP</strong> offers ~30% smaller sizes than PNG while keeping alpha transparency.
          </p>
        </div>
      </div>
    </div>
  );
}
