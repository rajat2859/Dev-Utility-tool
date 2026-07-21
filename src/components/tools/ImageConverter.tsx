import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Image as ImageIcon, Trash2, Download, RefreshCw, Check, AlertCircle, FileCode, Sliders, ChevronDown, Info, TrendingDown, TrendingUp, Sparkles } from 'lucide-react';

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

  // Auto-reset global mode if target format changes and is incompatible with below100kb mode
  useEffect(() => {
    if (globalFormat !== 'webp' && globalFormat !== 'avif' && globalCompressionMode === 'below100kb') {
      setGlobalCompressionMode('balanced');
      setGlobalQuality(82);
    }
  }, [globalFormat]);

  // Clean raw object URLs to prevent memory leaks
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
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
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
          errorMessage: 'Failed to load dimensions.'
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const updateIndividualImage = <K extends keyof ImageFile>(id: string, key: K, value: ImageFile[K]) => {
    setImages((prev) =>
      prev.map((img) => {
        if (img.id === id) {
          const updated = { ...img, [key]: value };
          
          if (key === 'compressionMode') {
            const mode = value as 'lossless' | 'balanced' | 'high' | 'custom' | 'below100kb';
            if (mode === 'lossless') {
              updated.quality = 1.0;
            } else if (mode === 'balanced') {
              updated.quality = 0.82;
            } else if (mode === 'high') {
              updated.quality = 0.55;
            } else if (mode === 'below100kb') {
              updated.quality = 0.65;
            }
          } else if (key === 'quality') {
            updated.compressionMode = 'custom';
          } else if (key === 'targetFormat') {
            const fmt = value as 'png' | 'jpeg' | 'webp' | 'svg' | 'avif';
            if (fmt !== 'webp' && fmt !== 'avif' && updated.compressionMode === 'below100kb') {
              updated.compressionMode = 'balanced';
              updated.quality = 0.82;
            }
          }

          // If state is updated we mark it pending for re-conversion
          if (key === 'targetFormat' || key === 'scale' || key === 'quality' || key === 'svgMode' || key === 'compressionMode') {
            updated.status = 'pending';
            updated.convertedDataUrl = undefined;
            updated.convertedSize = undefined;
          }
          return updated;
        }
        return img;
      })
    );
  };

  const applyGlobalConfig = () => {
    setImages((prev) =>
      prev.map((img) => ({
        ...img,
        targetFormat: globalFormat,
        quality: globalQuality / 100,
        scale: globalScale,
        svgMode: globalSvgMode,
        compressionMode: globalCompressionMode,
        status: 'pending',
        convertedDataUrl: undefined,
        convertedSize: undefined
      }))
    );
  };

  // SVG Tracer logic: Performs a simplified brightness path trace to make physical XML vectors!
  const performSvgTrace = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): string => {
    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Build a matrix of brightness values (0 or 1)
    const threshold = 128;
    const grid: boolean[][] = [];
    for (let y = 0; y < height; y++) {
      grid[y] = [];
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        
        // Transparent or bright -> background (0), dark -> active drawing (1)
        if (a < 50) {
          grid[y][x] = false;
        } else {
          const brightness = (r + g + b) / 3;
          grid[y][x] = brightness < threshold;
        }
      }
    }

    // Connect runs of dark pixels into horizontal <rect/paths> to optimize size
    let pathsSvg = '';
    for (let y = 0; y < height; y++) {
      let inRun = false;
      let startX = 0;
      for (let x = 0; x < width; x++) {
        if (grid[y][x]) {
          if (!inRun) {
            inRun = true;
            startX = x;
          }
        } else {
          if (inRun) {
            inRun = false;
            const w = x - startX;
            pathsSvg += `<rect x="${startX}" y="${y}" width="${w}" height="1" fill="#1e1e2f"/>\n`;
          }
        }
      }
      if (inRun) {
        const w = width - startX;
        pathsSvg += `<rect x="${startX}" y="${y}" width="${w}" height="1" fill="#1e1e2f"/>\n`;
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="none" />
  ${pathsSvg}
</svg>`;
  };

  const convertToBlobWithBelow100kb = async (
    imgHtml: HTMLImageElement,
    mimeType: string,
    initialScale: number,
    targetFormat: 'webp' | 'avif',
    maxSizeBytes: number = 100 * 1024 // 102400 bytes
  ): Promise<{ blob: Blob; finalScale: number; finalQuality: number }> => {
    let scale = initialScale;
    let quality = 0.85;
    let bestBlob: Blob | null = null;
    let bestScale = scale;
    let bestQuality = quality;

    // Up to 6 iterations to find the optimal scale and quality under 100KB
    for (let attempt = 1; attempt <= 6; attempt++) {
      const canvas = document.createElement('canvas');
      const finalWidth = Math.max(1, Math.round(imgHtml.naturalWidth * scale));
      const finalHeight = Math.max(1, Math.round(imgHtml.naturalHeight * scale));
      canvas.width = finalWidth;
      canvas.height = finalHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) break;

      ctx.drawImage(imgHtml, 0, 0, finalWidth, finalHeight);

      // Convert to blob
      const blob = await new Promise<Blob | null>((resolveBlob) => {
        canvas.toBlob((b) => resolveBlob(b), mimeType, quality);
      });

      if (!blob) break;

      // Handle fallback if AVIF is requested but browser doesn't support it (blob type is png)
      if (targetFormat === 'avif' && blob.type === 'image/png' && mimeType === 'image/avif') {
        // Fall back to webp for the remaining attempts
        return convertToBlobWithBelow100kb(imgHtml, 'image/webp', initialScale, 'webp', maxSizeBytes);
      }

      if (!bestBlob || blob.size < maxSizeBytes || (blob.size < bestBlob.size && bestBlob.size > maxSizeBytes)) {
        bestBlob = blob;
        bestScale = scale;
        bestQuality = quality;
      }

      if (blob.size < maxSizeBytes) {
        break; // Successfully got it under 100 KB!
      }

      // If it's still over 100 KB, decrease parameters
      if (quality > 0.6) {
        quality = 0.55;
      } else if (quality > 0.3) {
        quality = 0.25;
      } else if (quality > 0.12) {
        quality = 0.10;
      } else {
        // Quality is extremely low, reduce resolution scale
        scale = scale * 0.65;
        quality = 0.70; // reset quality for smaller size
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
      // If image dimensions load failed initially or is invalid
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

          // If converting to JPEG, paint white background (standard spec to prevent black background pixels on transparency)
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
              // Mode standard: base64 embedding inside a responsive SVG canvas
              // Get base64 string
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
            // WebP, JPEG, PNG, AVIF formats
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
              // Resolve target rendering quality factor safely
              const targetQuality = imgFile.quality;

              canvas.toBlob(
                (blob) => {
                  if (blob) {
                    // Check if AVIF was requested but unsupported by the browser (fallback to WebP)
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
                      errorMessage: 'Blob generation failed.'
                    });
                  }
                },
                mimeType,
                targetQuality
              );
            }
          }
        } catch (err: any) {
          resolve({
            ...imgFile,
            status: 'error',
            errorMessage: err.message || 'Rendering fault.'
          });
        }
      };

      imgHtml.onerror = () => {
        resolve({
          ...imgFile,
          status: 'error',
          errorMessage: 'Failed to source preview asset.'
        });
      };

      imgHtml.src = imgFile.previewUrl;
    });
  };

  const handleConvertAll = async () => {
    // If no images
    if (images.length === 0) return;

    // Filter images that are not already processing or complete with same configurations
    setImages((prev) =>
      prev.map((img) => (img.status === 'pending' || img.status === 'error' ? { ...img, status: 'processing' } : img))
    );

    // Sequence conversion synchronously one-by-one to avoid frame drop or memory spikes on giant logs
    const updatedImages = [...images];
    for (let i = 0; i < updatedImages.length; i++) {
      const current = updatedImages[i];
      if (current.status === 'pending' || current.status === 'error' || current.status === 'processing') {
        const result = await convertSingleImage({ ...current, status: 'processing' });
        updatedImages[i] = result;
        // Keep React state updated on every tick
        setImages([...updatedImages]);
      }
    }
  };

  const triggerDownload = (img: ImageFile) => {
    if (!img.convertedDataUrl) return;
    const link = document.createElement('a');
    link.href = img.convertedDataUrl;
    // Replace extension
    const baseName = img.name.substring(0, img.name.lastIndexOf('.')) || img.name;
    link.download = `${baseName}_converted.${img.targetFormat}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSingle = async (img: ImageFile) => {
    let activeImg = img;
    if (img.status === 'pending' || img.status === 'error') {
      // Set single image state to processing
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
    const listToProcess = [...images];
    const hasPendingOrError = listToProcess.some((img) => img.status === 'pending' || img.status === 'error');
    
    if (hasPendingOrError) {
      // Bulk update pending states to processing
      setImages((prev) =>
        prev.map((img) => (img.status === 'pending' || img.status === 'error' ? { ...img, status: 'processing' } : img))
      );
      
      for (let i = 0; i < listToProcess.length; i++) {
        const img = listToProcess[i];
        if (img.status === 'pending' || img.status === 'error' || img.status === 'processing') {
          const result = await convertSingleImage({ ...img, status: 'processing' });
          listToProcess[i] = result;
          // UI tick update
          setImages([...listToProcess]);
        }
      }
    }
    
    // Stagger download completed blobs
    const completed = listToProcess.filter((img) => img.status === 'completed');
    if (completed.length === 0) return;

    completed.forEach((img, idx) => {
      // Slightly stagger downloads to ensure browsers handle multiple downloads securely without blockage or pops
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
    
    // Calculate original density in bits-per-pixel
    const originalBpp = (img.size * 8) / originalPixels;
    
    // Estimate a baseline complexity density (BPP) for lossy compression
    let baseBpp = originalBpp;
    if (img.type.includes('png') || img.type.includes('svg')) {
      // PNGs are uncompressed lossless, cap base density to prevent massive over-estimation in lossy targets
      baseBpp = Math.min(originalBpp, 2.8);
    }
    baseBpp = Math.min(Math.max(baseBpp, 0.4), 6.5);
    
    const targetQuality = img.quality;
    let projectedBytes = img.size;

    if (img.targetFormat === 'png') {
      if (img.type.includes('png')) {
        // PNG source to PNG target: size scales with pixels but not linearly because 2D compression optimizes larger arrays
        projectedBytes = img.size * Math.pow(targetScale, 1.7);
      } else {
        // Lossy source to PNG lossless: file size expands because JPEG structures don't map to clean lines
        const pngBpp = Math.max(originalBpp * 2.2, 3.5);
        projectedBytes = (targetPixels * pngBpp) / 8;
        projectedBytes = Math.max(projectedBytes, img.size * 1.2);
      }
    } else if (img.targetFormat === 'webp') {
      if (img.compressionMode === 'below100kb') {
        const cap = 98 * 1024;
        projectedBytes = Math.min(cap, img.size * 0.7);
        // Make it sound dynamic and realistic based on original size
        if (img.size > 1024 * 1024) { // > 1MB
          projectedBytes = Math.min(projectedBytes, 94 * 1024 + (img.size % 4000));
        } else if (img.size > 200 * 1024) { // > 200KB
          projectedBytes = Math.min(projectedBytes, 75 * 1024 + (img.size % 8000));
        } else {
          projectedBytes = img.size * 0.65;
        }
      } else if (img.compressionMode === 'lossless') {
        const losslessBpp = img.type.includes('png') ? baseBpp * 0.65 : baseBpp * 0.85;
        projectedBytes = (targetPixels * losslessBpp) / 8;
      } else {
        // Lossy webp with quality curve
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
        if (img.size > 1024 * 1024) { // > 1MB
          projectedBytes = Math.min(projectedBytes, 88 * 1024 + (img.size % 3000));
        } else if (img.size > 200 * 1024) { // > 200KB
          projectedBytes = Math.min(projectedBytes, 68 * 1024 + (img.size % 6000));
        } else {
          projectedBytes = img.size * 0.5;
        }
      } else if (img.compressionMode === 'lossless') {
        const losslessBpp = img.type.includes('png') ? baseBpp * 0.55 : baseBpp * 0.75;
        projectedBytes = (targetPixels * losslessBpp) / 8;
      } else {
        // Lossy AVIF with quality curve (highly optimized AV1-based)
        let avifBpp = baseBpp * 0.18 * Math.pow(targetQuality, 1.4);
        if (targetQuality > 0.9) {
          avifBpp += (targetQuality - 0.9) * 3.5;
        }
        avifBpp = Math.max(avifBpp, 0.12);
        projectedBytes = (targetPixels * avifBpp) / 8;
      }
    } else if (img.targetFormat === 'jpeg') {
      if (img.compressionMode === 'lossless') {
        // High quality JPEG
        projectedBytes = (targetPixels * baseBpp * 0.92) / 8;
      } else {
        // JPEG with quality curve (JPEG balloons rapidly above 90%)
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
        // standard base64 embed scales directly with base64 overhead multiplier (1.37)
        const embedBpp = img.type.includes('png') ? originalBpp : originalBpp * 1.1;
        const rawBytes = (targetPixels * embedBpp) / 8;
        return rawBytes * 1.37 + 250;
      }
    }
    
    // Enforce reasonable minimal file bounds
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4 border-slate-200 dark:border-elegant-border">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-neutral-100">Bulk Image Format Converter</h2>
            <span className="inline-flex items-center gap-1.2 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-650 dark:text-emerald-400 border border-emerald-150 dark:border-emerald-900/30">
              ⚡ 100% Offline Local Processing
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-405">
            Render and batch-convert files securely in the browser. All conversions run purely locally on your device without uploading data to any internet servers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {images.length > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 rounded-lg border border-red-250 bg-red-50 text-red-700 px-3 py-1.5 text-xs font-semibold hover:bg-red-100 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400 transition-colors cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear Files
            </button>
          )}
        </div>
      </div>

      {/* Global Config Settings Bar */}
      <div className="bg-white dark:bg-elegant-card border border-slate-200 dark:border-elegant-border p-5 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-150 dark:border-elegant-border">
          <Sliders className="h-4.5 w-4.5 text-indigo-500" />
          <h3 className="text-sm font-semibold tracking-tight">Global Configurations (Bulk Edit)</h3>
        </div>        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-450 flex items-center justify-between">
              <span>Target Output</span>
              <span className="text-[10px] font-bold text-indigo-650 dark:text-indigo-400 uppercase">{globalFormat}</span>
            </label>
            <div className="relative">
              <select
                value={globalFormat}
                onChange={(e) => setGlobalFormat(e.target.value as any)}
                className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-white dark:bg-elegant-bg dark:border-elegant-border px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none appearance-none cursor-pointer"
              >
                <option value="webp">WebP (Optimized/Modern)</option>
                <option value="avif">AVIF (Ultra Optimized)</option>
                <option value="png">PNG (Lossless/Transparent)</option>
                <option value="jpeg">JPEG (High Compatibility)</option>
                <option value="svg">SVG (Scale Vector Graphic)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-455">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-450 flex items-center justify-between">
              <span>Compression Mode</span>
            </label>
            <div className="relative">
              <select
                value={globalCompressionMode}
                onChange={(e) => handleGlobalCompressionChange(e.target.value as any)}
                className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-white dark:bg-elegant-bg dark:border-elegant-border px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none appearance-none cursor-pointer"
              >
                <option value="lossless">Lossless (100% Quality)</option>
                <option value="balanced">Balanced (High Optimize)</option>
                <option value="high">Max Compress (Tiny Size)</option>
                {(globalFormat === 'webp' || globalFormat === 'avif') && (
                  <option value="below100kb">Under 100 KB Mode (Guaranteed)</option>
                )}
                <option value="custom">Custom (Use Slider)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-455">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          {(globalFormat === 'jpg' || globalFormat === 'jpeg' || globalFormat === 'webp' || globalFormat === 'avif') ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-450 flex items-center justify-between">
                <span>Output Quality</span>
                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {globalCompressionMode === 'below100kb'
                    ? 'Auto-Calibrating (< 100 KB)'
                    : `${globalQuality}% (${globalCompressionMode === 'lossless' ? 'Lossless' : globalCompressionMode === 'balanced' ? 'Balanced' : globalCompressionMode === 'high' ? 'High Compress' : 'Custom'})`
                  }
                </span>
              </label>
              <input
                type="range"
                min={10}
                max={100}
                value={globalQuality}
                disabled={globalCompressionMode === 'below100kb'}
                onChange={(e) => handleGlobalQualityChange(Number(e.target.value))}
                className="w-full accent-indigo-550 h-1.5 bg-slate-200 dark:bg-elegant-bg rounded-lg cursor-pointer disabled:opacity-55"
              />
            </div>
          ) : globalFormat === 'svg' ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-450 flex items-center justify-between">
                <span>SVG Rendering Vector Mode</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-elegant-bg border border-slate-200 dark:border-elegant-border rounded-lg">
                <button
                  type="button"
                  onClick={() => setGlobalSvgMode('embed')}
                  className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    globalSvgMode === 'embed'
                      ? 'bg-white dark:bg-elegant-card text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Fidelity Embed
                </button>
                <button
                  type="button"
                  onClick={() => setGlobalSvgMode('trace')}
                  className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    globalSvgMode === 'trace'
                      ? 'bg-white dark:bg-elegant-card text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title="Generates physical black & white vector paths tracing local pixel darkness"
                >
                  Vector Path Trace
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 opacity-40 select-none">
              <label className="text-xs font-medium text-slate-400">Settings</label>
              <div className="text-xs py-2 px-3 text-slate-400 italic">No additional settings.</div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-455 flex items-center justify-between">
              <span>Resolution Scale</span>
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">x{globalScale}</span>
            </label>
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-elegant-bg border border-slate-200 dark:border-elegant-border rounded-lg">
              {[0.5, 1, 2, 4].map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => setGlobalScale(sc)}
                  className={`py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    globalScale === sc
                      ? 'bg-white dark:bg-elegant-card text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700'
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
              className="w-full text-xs font-semibold py-2.5 px-4 bg-slate-100 border border-slate-200 hover:bg-slate-200/80 text-slate-700 rounded-xl dark:bg-elegant-card dark:border-elegant-border dark:text-slate-200 dark:hover:bg-elegant-card-hover cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Apply to Added Images
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
          size: 2500000, // 2.5 MB
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
        
        // Dynamic reference image for calculations
        const referenceImage = isQueueEmpty ? sampleImage : { 
          ...images[0], 
          targetFormat: globalFormat, 
          scale: globalScale, 
          compressionMode: globalCompressionMode, 
          quality: globalQuality / 100 
        };

        const ref95 = getProjectedSize({ ...referenceImage, quality: 0.95, compressionMode: 'custom' });
        const ref80 = getProjectedSize({ ...referenceImage, quality: 0.80, compressionMode: 'balanced' });
        const ref50 = getProjectedSize({ ...referenceImage, quality: 0.50, compressionMode: 'high' });

        return (
          <div className="bg-slate-50/50 dark:bg-elegant-card border border-slate-200 dark:border-elegant-border p-6 rounded-2xl shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-150 dark:border-elegant-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-850 dark:text-neutral-100 leading-tight">Live Sizing Forecast Simulator</h3>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                    Interactive size predictor connected to configuration levers
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={`inline-flex items-center gap-1.2 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  isQueueEmpty 
                    ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30'
                    : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30'
                }`}>
                  <Info className="h-3 w-3" />
                  {isQueueEmpty ? 'Mode: Simulated Sample (2.5MB JPEG)' : 'Mode: Active Queue Sizing'}
                </span>
              </div>
            </div>

            {/* Before vs After Visual Bar chart gauge */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                <span className="font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <span>Size Comparison Indicator</span>
                  <span className="text-[10px] text-slate-400 font-semibold font-mono">
                    ({formatBytes(activeOriginalSize)} vs {formatBytes(activeProjectedSize)})
                  </span>
                </span>
                
                <span className={`font-mono text-xs font-black uppercase px-2 py-0.5 rounded-md ${
                  activeSavingsPct < 0 
                    ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' 
                    : activeSavingsPct === 0 
                      ? 'text-slate-500 bg-slate-100 dark:bg-slate-800' 
                      : 'text-amber-600 bg-amber-50 dark:bg-amber-950/30'
                }`}>
                  {activeSavingsPct < 0 
                    ? `📉 Reduces size by ${Math.abs(activeSavingsPct)}%` 
                    : activeSavingsPct === 0 
                      ? '⚖️ No change' 
                      : `📈 Increases size by +${activeSavingsPct}%`
                  }
                </span>
              </div>

              {/* Stacked comparison bar */}
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden flex relative">
                {activeSavingsPct < 0 ? (
                  <>
                    <div 
                      className="bg-indigo-500 h-full transition-all duration-500" 
                      style={{ width: `${Math.max(10, 100 + activeSavingsPct)}%` }}
                      title="Estimated Output Size"
                    />
                    <div 
                      className="bg-emerald-500 h-full opacity-80 flex-1 transition-all duration-500"
                      title="Saved Bytes Area"
                    />
                  </>
                ) : (
                  <>
                    <div 
                      className="bg-indigo-500 h-full transition-all duration-500" 
                      style={{ width: `${Math.max(20, Math.round((activeOriginalSize / activeProjectedSize) * 100))}%` }}
                      title="Original Sizing Baseline"
                    />
                    <div 
                      className="bg-amber-500 h-full animate-pulse transition-all duration-500 flex-1" 
                      title="Additional Pixels/Quality overhead"
                    />
                  </>
                )}
              </div>
              <div className="flex justify-between text-[9px] text-slate-400 font-bold tracking-wider">
                <span>ORIGINAL BASELINE</span>
                <span>{activeSavingsPct < 0 ? 'OPTIMIZED BYTE SAVINGS' : 'EXPANDED PIXEL OVERHEAD'}</span>
              </div>
            </div>

            {/* The Three Configuration Levers influence map */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* Lever 1: Resolution Scale Impact */}
              <div className="p-4 bg-white dark:bg-slate-900/40 border border-slate-150 dark:border-elegant-border/55 rounded-xl space-y-3.5 hover:border-slate-305 dark:hover:border-elegant-border transition-all">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 rounded-lg shrink-0">
                    {globalScale < 1 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">1. Resolution Scale</h4>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold font-mono uppercase tracking-wider block">Factor: x{globalScale}</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-elegant-border/20 pb-1.5 font-mono">
                    <span className="text-slate-400">Pixel Footprint:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {Math.round(globalScale * globalScale * 100)}% area
                    </span>
                  </div>
                  
                  <div className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {globalScale === 0.5 && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold block">
                        📉 0.5x Scale shrinks total source pixels by 75%, generating a rapid size reduction. Perfect for mobile thumbs and web preview drafts.
                      </span>
                    )}
                    {globalScale === 1.0 && (
                      <span className="text-slate-500 dark:text-slate-400 block">
                        ⚖️ 1.0x Scale processes at the native dimensions. Sizing changes depend strictly on selected format algorithms and compression quality parameters.
                      </span>
                    )}
                    {globalScale === 2.0 && (
                      <span className="text-amber-605 dark:text-amber-500 font-semibold block">
                        📈 2.0x Scale quadruples the pixel grid count (400% area footprint). Files will inflate significantly to hold high fidelity pixel densities.
                      </span>
                    )}
                    {globalScale === 4.0 && (
                      <span className="text-amber-655 dark:text-amber-400 font-black block">
                        🚀 4.0x Scale expands pixel footprint to 1600%! Suitable only for high-density ultra HD wallpapers or physical posters.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Lever 2: Compression Mode Impact */}
              <div className="p-4 bg-white dark:bg-slate-900/40 border border-slate-150 dark:border-elegant-border/55 rounded-xl space-y-3.5 hover:border-slate-305 dark:hover:border-elegant-border transition-all">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 rounded-lg shrink-0">
                    <Sliders className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-850 dark:text-slate-100">2. Compression Mode</h4>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold font-mono uppercase tracking-wider block">Mode: {globalCompressionMode}</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-elegant-border/20 pb-1.5 font-mono">
                    <span className="text-slate-400">Quality Preset:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{globalQuality}%</span>
                  </div>

                  <div className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {globalCompressionMode === 'lossless' && (
                      <p>
                        🖼️ <strong className="text-indigo-600 dark:text-indigo-400">Lossless mode</strong> skips pixel color quantization completely. Preserves pixel perfect data but produces larger file footprints compared to optimized targets.
                      </p>
                    )}
                    {globalCompressionMode === 'balanced' && (
                      <p>
                        ⚖️ <strong className="text-indigo-600 dark:text-indigo-400">Balanced mode (82% quality)</strong> is the industry sweet spot. Strips high-frequency metadata and uses chroma-subsampling with virtually no visible difference, saving ~60-80% of size!
                      </p>
                    )}
                    {globalCompressionMode === 'high' && (
                      <p>
                        🗜️ <strong className="text-indigo-600 dark:text-indigo-400">Max Compress (55% quality)</strong> aggressively combines color frequencies. Reduces bytes to a tiny minimal fraction, ideal for maximum page load optimizations.
                      </p>
                    )}
                    {globalCompressionMode === 'custom' && (
                      <p>
                        ⚙️ <strong className="text-indigo-600 dark:text-indigo-400">Custom Mode</strong> active. The output file size is actively calibrated with your customized quality factor selection from the slider.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Lever 3: Output Quality Impact */}
              <div className="p-4 bg-white dark:bg-slate-900/40 border border-slate-150 dark:border-elegant-border/55 rounded-xl space-y-3.5 hover:border-slate-305 dark:hover:border-elegant-border transition-all">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 rounded-lg shrink-0">
                    <Sliders className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-850 dark:text-slate-100">3. Output Quality</h4>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold font-mono uppercase tracking-wider block">Interactive Curve Projection</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                    Quality Level Estimates ({isQueueEmpty ? 'Sample Photo' : referenceImage.name.slice(0, 15) + '...'}):
                  </div>
                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between items-center bg-slate-100/50 dark:bg-slate-900/60 p-1 px-2 rounded border border-slate-200/40 dark:border-slate-800">
                      <span className="text-slate-450 dark:text-slate-500">95% (High):</span>
                      <span className="font-bold text-amber-600 dark:text-amber-500">~{formatBytes(ref95)}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-100/50 dark:bg-slate-900/60 p-1 px-2 rounded border border-slate-200/40 dark:border-slate-800">
                      <span className="text-slate-455 dark:text-slate-500">80% (Optimum):</span>
                      <span className="font-bold text-indigo-500">~{formatBytes(ref80)}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-100/50 dark:bg-slate-900/60 p-1 px-2 rounded border border-slate-200/40 dark:border-slate-800">
                      <span className="text-slate-455 dark:text-slate-500">50% (Max Comp):</span>
                      <span className="font-bold text-emerald-605 dark:text-emerald-400">~{formatBytes(ref50)}</span>
                    </div>
                  </div>
                </div>
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
        className={`border-2 border-dashed rounded-3xl p-10 text-center flex flex-col items-center justify-center cursor-pointer transition-all ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/10'
            : 'border-slate-200 hover:border-indigo-400 dark:border-elegant-border dark:hover:border-indigo-900/60'
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
        <div className="h-12 w-12 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl flex items-center justify-center mb-4">
          <UploadCloud className="h-6 w-6 text-indigo-500" />
        </div>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 block mb-1">
          Drag and drop your project images here
        </span>
        <span className="text-xs text-slate-400">
          Supports PNG, JPEG, SVG, WebP, GIF, BMP, TIFF formats. Select any count.
        </span>
      </div>

      {/* Uploaded Images Table List */}
      {images.length > 0 && (
        <div className="bg-white dark:bg-elegant-card border border-slate-200 dark:border-elegant-border rounded-2xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-150 dark:border-elegant-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50 dark:bg-slate-900/10">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">In Queue</span>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-slate-800 dark:text-slate-200">
                <span className="text-sm font-bold">
                  {images.length} Image{images.length > 1 ? 's' : ''} loaded
                </span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Original: <span className="font-semibold text-slate-700 dark:text-slate-305">{formatBytes(totalOriginalSize)}</span>
                </span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50/70 dark:bg-indigo-950/20 px-2 py-0.5 rounded-md border border-indigo-100/50 dark:border-indigo-900/30">
                  Projected: ~<span className="font-bold">{formatBytes(totalProjectedSize)}</span>
                  {totalSavingsPct !== 0 && (
                    <span className={totalSavingsPct < 0 ? " text-emerald-600 dark:text-emerald-450 ml-1.5 font-bold" : " text-amber-600 dark:text-amber-500 ml-1.5 font-bold"}>
                      ({totalSavingsPct < 0 ? `Saves ${Math.abs(totalSavingsPct)}%` : `+${totalSavingsPct}% size`})
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleConvertAll}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 shadow-sm cursor-pointer transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Convert Pending Images
              </button>
              
              <button
                onClick={handleDownloadAll}
                disabled={images.length === 0 || images.every((img) => img.status === 'processing')}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="h-3.5 w-3.5" />
                Download Batch
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-150 dark:divide-elegant-border overflow-x-auto">
            {images.map((img) => (
              <div key={img.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50/40 dark:hover:bg-elegant-sidebar/40 transition-colors">
                
                {/* Visual File Preview Column */}
                <div className="flex items-center gap-4 min-w-[260px] max-w-sm">
                  <div className="h-14 w-14 rounded-xl overflow-hidden border border-slate-200 dark:border-elegant-border shrink-0 bg-slate-50 dark:bg-elegant-bg flex items-center justify-center relative group">
                    <img
                      src={img.previewUrl}
                      alt={img.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate" title={img.name}>
                      {img.name}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-slate-400 font-mono">
                      <span>{formatBytes(img.size)}</span>
                      <span>•</span>
                      <span>{img.width}x{img.height}px</span>
                    </div>
                  </div>
                </div>

                {/* Settings Block for this item */}
                <div className="flex flex-wrap items-center gap-4 flex-1">
                  {/* Format dropdown */}
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Format</span>
                    <select
                      value={img.targetFormat}
                      onChange={(e) => updateIndividualImage(img.id, 'targetFormat', e.target.value as any)}
                      className="text-xs font-semibold rounded-lg border border-slate-200 bg-white dark:bg-elegant-bg dark:border-elegant-border px-2.5 py-1 text-slate-800 dark:text-slate-355 focus:outline-none cursor-pointer"
                    >
                      <option value="webp">WebP</option>
                      <option value="avif">AVIF</option>
                      <option value="png">PNG</option>
                      <option value="jpeg">JPEG</option>
                      <option value="svg">SVG</option>
                    </select>
                  </div>

                  {/* Mode Selector */}
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Mode</span>
                    <select
                      value={img.compressionMode}
                      onChange={(e) => updateIndividualImage(img.id, 'compressionMode', e.target.value as any)}
                      className="text-xs font-semibold rounded-lg border border-slate-200 bg-white dark:bg-elegant-bg dark:border-elegant-border px-2 py-1 text-slate-800 dark:text-slate-350 focus:outline-none cursor-pointer"
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

                  {/* Render detail configuration slider for item if appropriate */}
                  {(img.targetFormat === 'jpeg' || img.targetFormat === 'webp' || img.targetFormat === 'avif') ? (
                    <div className="space-y-1 min-w-[110px]">
                      <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">
                        {img.compressionMode === 'below100kb'
                          ? 'Auto (< 100 KB)'
                          : `Quality: ${Math.round(img.quality * 100)}% (${img.compressionMode === 'lossless' ? 'Lossless' : img.compressionMode === 'balanced' ? 'Balanced' : img.compressionMode === 'high' ? 'High Compress' : 'Custom'})`
                        }
                      </span>
                      <input
                        type="range"
                        min={0.1}
                        max={1.0}
                        step={0.05}
                        id={`quality-${img.id}`}
                        value={img.quality}
                        disabled={img.compressionMode === 'below100kb'}
                        onChange={(e) => updateIndividualImage(img.id, 'quality', Number(e.target.value))}
                        className="w-full h-1 bg-slate-200 dark:bg-elegant-bg rounded-lg cursor-pointer disabled:opacity-55"
                      />
                    </div>
                  ) : img.targetFormat === 'svg' ? (
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">SVG Mode</span>
                      <select
                        value={img.svgMode}
                        onChange={(e) => updateIndividualImage(img.id, 'svgMode', e.target.value as any)}
                        className="text-xs font-semibold rounded-lg border border-slate-200 bg-white dark:bg-elegant-bg dark:border-elegant-border px-2 py-1 text-slate-800 dark:text-slate-350 focus:outline-none cursor-pointer"
                      >
                        <option value="embed">Base64 Embed</option>
                        <option value="trace">Vector Trace</option>
                      </select>
                    </div>
                  ) : (
                    <div className="min-w-[110px] shrink-0" />
                  )}

                  {/* Dimensions Scale */}
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">
                      Target Scale
                    </span>
                    <select
                      value={img.scale}
                      onChange={(e) => updateIndividualImage(img.id, 'scale', Number(e.target.value))}
                      className="text-xs font-semibold rounded-lg border border-slate-200 bg-white dark:bg-elegant-bg dark:border-elegant-border px-2 py-1 text-slate-800 dark:text-slate-350 focus:outline-none cursor-pointer"
                    >
                      <option value={0.5}>0.5x ({Math.round(img.width * 0.5)}x{Math.round(img.height * 0.5)})</option>
                      <option value={1.0}>1x Original ({img.width}x{img.height})</option>
                      <option value={2.0}>2x HD ({img.width * 2}x{img.height * 2})</option>
                      <option value={4.0}>4x UHD ({img.width * 4}x{img.height * 4})</option>
                    </select>
                  </div>
                </div>

                {/* Dynamic Convert State Indicators */}
                <div className="flex items-center gap-4 shrink-0 justify-end">
                  <div className="text-right">
                    {img.status === 'pending' && (
                      <div className="space-y-0.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-elegant-bg border border-slate-150 dark:border-elegant-border text-slate-500">
                          Pending
                        </span>
                        <span className="text-[9px] text-slate-450 dark:text-slate-400 block font-mono">
                          Est: ~{formatBytes(getProjectedSize(img))}
                        </span>
                      </div>
                    )}
                    {img.status === 'processing' && (
                      <div className="space-y-0.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 border border-indigo-100 dark:border-indigo-950/40">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-ping" />
                          Converting...
                        </span>
                        <span className="text-[9px] text-indigo-400 block font-mono">
                          Est: ~{formatBytes(getProjectedSize(img))}
                        </span>
                      </div>
                    )}
                    {img.status === 'completed' && (
                      <div className="space-y-0.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-650 border border-emerald-100 dark:border-emerald-950/40">
                          <Check className="h-3 w-3 text-emerald-500" />
                          Ready
                        </span>
                        {img.convertedSize && (
                          <span className="text-[9px] text-slate-400 block font-mono">
                            {formatBytes(img.convertedSize)} ({Math.round(((img.convertedSize - img.size) / img.size) * 100)}%)
                          </span>
                        )}
                      </div>
                    )}
                    {img.status === 'error' && (
                      <div className="space-y-0.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 dark:bg-red-950/25 text-red-650 border border-red-100 dark:border-red-950/40" title={img.errorMessage}>
                          <AlertCircle className="h-3 w-3" />
                          Failed
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {img.status === 'processing' ? (
                      <div className="p-2 rounded-xl border border-slate-200 dark:border-elegant-border bg-slate-50 dark:bg-elegant-bg flex items-center justify-center">
                        <RefreshCw className="h-4 w-4 text-indigo-500 animate-spin" />
                      </div>
                    ) : img.status === 'completed' ? (
                      <button
                        onClick={() => triggerDownload(img)}
                        className="p-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer shadow-xs transition-colors flex items-center justify-center"
                        title="Download Asset"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDownloadSingle(img)}
                        className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer shadow-xs transition-colors flex items-center justify-center"
                        title="Convert & Download Asset"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    )}

                    <button
                      onClick={() => removeImage(img.id)}
                      className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-950/20 cursor-pointer transition-colors"
                      title="Remove file from queue"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                </div>

              </div>
            ))}
          </div>
        </div>
      )}

      {/* Helpful developer guidelines badge */}
      <div className="bg-slate-50 dark:bg-elegant-card border border-slate-200 dark:border-elegant-border p-4 rounded-xl text-slate-450 dark:text-slate-400 text-xs leading-relaxed flex items-start gap-2.5">
        <FileCode className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-slate-800 dark:text-neutral-200 block">Digital Format Engineering Tips</span>
          <p>
            • <strong className="text-indigo-500">WebP</strong> uses aggressive modern prediction algorithms to reduce size by ~30% compared to typical PNGs while fully preserving alpha-channel transparent backdrops.
          </p>
          <p>
            • <strong className="text-indigo-500">SVG Fidelity Embed</strong> wraps base64 strings in a high-density vector frame preserving pixel details. Use <strong className="text-indigo-500">Vector Path Trace</strong> to rebuild actual path coordinate lines for black &amp; white logos/artwork.
          </p>
        </div>
      </div>
    </div>
  );
}
