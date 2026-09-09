import { FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Check, ChevronDown, CircleCheck, ExternalLink, LoaderCircle, Maximize2,
  Monitor, RefreshCw, RotateCw, Ruler, Share2, Smartphone, Tablet, Trash2, X, ZoomIn,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { copyText } from '../../lib/utils';

type Group = 'mobile' | 'tablet' | 'desktop' | 'custom';
type Brand = 'apple' | 'samsung' | 'google' | 'microsoft' | 'windows';
type Device = { id: string; label: string; width: number; height: number; group: Group; brand?: Brand };

type Offender = { index: number; selector: string; tag: string; width: number; overhang: number; text: string; ghost: boolean };
type Report = {
  status: 'pending' | 'ready' | 'error';
  overflow: boolean;
  // Content reaches past the viewport but the root's overflow-x:hidden stops
  // the page from panning. Not a scrollbar, still usually a latent bug.
  clipped: boolean;
  overflowAmount: number;
  viewportWidth: number;
  documentWidth: number;
  scrollHeight: number;
  // Boxes that reach past the edge while painting nothing. They never set the
  // verdict — a transparent 103% wrapper is not something a visitor can see.
  ghosts: number;
  offenders: Offender[];
  message?: string;
  since: number;
};

const GROUP_META: Record<Group, { label: string; icon: typeof Smartphone }> = {
  mobile: { label: 'Mobile', icon: Smartphone },
  tablet: { label: 'Tablet', icon: Tablet },
  desktop: { label: 'Desktop', icon: Monitor },
  custom: { label: 'Custom', icon: Ruler },
};

const GROUP_ORDER: Group[] = ['mobile', 'tablet', 'desktop', 'custom'];

const BRAND_LABEL: Record<Brand, string> = {
  apple: 'Apple',
  samsung: 'Samsung',
  google: 'Google',
  microsoft: 'Microsoft',
  windows: 'Windows',
};

// Which vendor tabs each category offers, in display order. 'custom' has none —
// it is driven by the width/height inputs instead.
const BRANDS_BY_GROUP: Record<Group, Brand[]> = {
  mobile: ['apple', 'samsung', 'google'],
  tablet: ['apple', 'samsung', 'microsoft'],
  desktop: ['apple', 'windows'],
  custom: [],
};

// CSS-pixel viewports, not physical panel resolutions — a media query only ever
// sees these. Sorted narrowest-first within each vendor so the dropdown reads
// like a size ladder.
const DEVICE_LIBRARY: Device[] = [
  { id: 'iphone-se', label: 'iPhone SE', width: 375, height: 667, group: 'mobile', brand: 'apple' },
  { id: 'iphone-x', label: 'iPhone X / XS / 11 Pro', width: 375, height: 812, group: 'mobile', brand: 'apple' },
  { id: 'iphone-13-mini', label: 'iPhone 13 mini', width: 375, height: 812, group: 'mobile', brand: 'apple' },
  { id: 'iphone-12', label: 'iPhone 12 / 13 / 14', width: 390, height: 844, group: 'mobile', brand: 'apple' },
  { id: 'iphone-15-pro', label: 'iPhone 14 Pro / 15 / 16', width: 393, height: 852, group: 'mobile', brand: 'apple' },
  { id: 'iphone-16-pro', label: 'iPhone 16 Pro', width: 402, height: 874, group: 'mobile', brand: 'apple' },
  { id: 'iphone-11', label: 'iPhone XR / 11', width: 414, height: 896, group: 'mobile', brand: 'apple' },
  { id: 'iphone-14-plus', label: 'iPhone 14 Plus', width: 428, height: 926, group: 'mobile', brand: 'apple' },
  { id: 'iphone-15-max', label: 'iPhone 15 Pro Max', width: 430, height: 932, group: 'mobile', brand: 'apple' },
  { id: 'iphone-16-max', label: 'iPhone 16 Pro Max', width: 440, height: 956, group: 'mobile', brand: 'apple' },

  { id: 'galaxy-fold-cover', label: 'Galaxy Z Fold (cover)', width: 344, height: 882, group: 'mobile', brand: 'samsung' },
  { id: 'galaxy-s9', label: 'Galaxy S8 / S9', width: 360, height: 740, group: 'mobile', brand: 'samsung' },
  { id: 'galaxy-s23', label: 'Galaxy S23', width: 360, height: 780, group: 'mobile', brand: 'samsung' },
  { id: 'galaxy-s20', label: 'Galaxy S20 / S21', width: 360, height: 800, group: 'mobile', brand: 'samsung' },
  { id: 'galaxy-s24', label: 'Galaxy S24 Ultra', width: 384, height: 824, group: 'mobile', brand: 'samsung' },
  { id: 'galaxy-note-20', label: 'Galaxy Note 20', width: 412, height: 915, group: 'mobile', brand: 'samsung' },
  { id: 'galaxy-fold-open', label: 'Galaxy Z Fold (unfolded)', width: 674, height: 841, group: 'mobile', brand: 'samsung' },

  { id: 'pixel-4', label: 'Pixel 4', width: 353, height: 745, group: 'mobile', brand: 'google' },
  { id: 'pixel-5', label: 'Pixel 5', width: 393, height: 851, group: 'mobile', brand: 'google' },
  { id: 'pixel-6', label: 'Pixel 6 / 6 Pro', width: 412, height: 892, group: 'mobile', brand: 'google' },
  { id: 'pixel-7', label: 'Pixel 7 / 8', width: 412, height: 915, group: 'mobile', brand: 'google' },
  { id: 'pixel-8-pro', label: 'Pixel 8 Pro / 9 Pro', width: 448, height: 998, group: 'mobile', brand: 'google' },

  { id: 'ipad-mini', label: 'iPad Mini', width: 768, height: 1024, group: 'tablet', brand: 'apple' },
  { id: 'ipad-9', label: 'iPad 9th gen', width: 810, height: 1080, group: 'tablet', brand: 'apple' },
  { id: 'ipad-air', label: 'iPad Air / iPad 10th gen', width: 820, height: 1180, group: 'tablet', brand: 'apple' },
  { id: 'ipad-pro-11', label: 'iPad Pro 11 inch', width: 834, height: 1194, group: 'tablet', brand: 'apple' },
  { id: 'ipad-pro-13', label: 'iPad Pro 12.9 inch', width: 1024, height: 1366, group: 'tablet', brand: 'apple' },

  { id: 'galaxy-tab-s8', label: 'Galaxy Tab S8', width: 800, height: 1280, group: 'tablet', brand: 'samsung' },
  { id: 'galaxy-tab-s9-plus', label: 'Galaxy Tab S9+', width: 856, height: 1370, group: 'tablet', brand: 'samsung' },
  { id: 'galaxy-tab-s8-ultra', label: 'Galaxy Tab S8 Ultra', width: 960, height: 1540, group: 'tablet', brand: 'samsung' },

  { id: 'surface-duo', label: 'Surface Duo', width: 540, height: 720, group: 'tablet', brand: 'microsoft' },
  { id: 'surface-go', label: 'Surface Go', width: 768, height: 1024, group: 'tablet', brand: 'microsoft' },
  { id: 'surface-pro', label: 'Surface Pro 7 / 8', width: 912, height: 1368, group: 'tablet', brand: 'microsoft' },

  { id: 'macbook-air-13', label: 'MacBook Air 13 inch', width: 1280, height: 800, group: 'desktop', brand: 'apple' },
  { id: 'macbook-pro-13', label: 'MacBook Pro 13 inch', width: 1440, height: 900, group: 'desktop', brand: 'apple' },
  { id: 'macbook-pro-14', label: 'MacBook Pro 14 inch', width: 1512, height: 982, group: 'desktop', brand: 'apple' },
  { id: 'macbook-pro-16', label: 'MacBook Pro 16 inch', width: 1728, height: 1117, group: 'desktop', brand: 'apple' },
  { id: 'imac-24', label: 'iMac 24 inch', width: 2048, height: 1152, group: 'desktop', brand: 'apple' },
  { id: 'studio-display', label: 'Studio Display', width: 2560, height: 1440, group: 'desktop', brand: 'apple' },
  { id: 'pro-display-xdr', label: 'Pro Display XDR', width: 3008, height: 1692, group: 'desktop', brand: 'apple' },

  { id: 'laptop-1366', label: 'Laptop 1366', width: 1366, height: 768, group: 'desktop', brand: 'windows' },
  { id: 'surface-laptop', label: 'Surface Laptop', width: 1504, height: 1000, group: 'desktop', brand: 'windows' },
  { id: 'laptop-1600', label: 'Laptop HD+', width: 1600, height: 900, group: 'desktop', brand: 'windows' },
  { id: 'desktop-fhd', label: 'Full HD 1080p', width: 1920, height: 1080, group: 'desktop', brand: 'windows' },
  { id: 'desktop-qhd', label: 'QHD 1440p', width: 2560, height: 1440, group: 'desktop', brand: 'windows' },
  { id: 'desktop-ultrawide', label: 'Ultrawide', width: 3440, height: 1440, group: 'desktop', brand: 'windows' },
  { id: 'desktop-4k', label: '4K UHD', width: 3840, height: 2160, group: 'desktop', brand: 'windows' },
];

const DEFAULT_DEVICE_ID = 'iphone-15-pro';

const RECENT_STORAGE_KEY = 'dev_tools_recent_preview_urls';
const DEVICE_STORAGE_KEY = 'dev_tools_preview_device';
const MAX_RECENT_URLS = 6;
const PROBE_TIMEOUT_MS = 18000;
const PROXY_ENDPOINT = '/api/responsive/proxy';
const FRAME_ID = 'stage';
const ZOOM_STEPS = [1, 0.75, 0.5, 0.33, 0.25];
const POP_HEADER_HEIGHT = 52;

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withScheme);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function displayUrl(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function uaKeyFor(group: Group, width: number) {
  if (group === 'mobile') return 'mobile';
  if (group === 'tablet') return 'tablet';
  if (group === 'custom') return width < 600 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
  return 'desktop';
}

function frameSource(url: string, device: Device, frameKey: number) {
  const params = new URLSearchParams({
    url,
    fid: FRAME_ID,
    ua: uaKeyFor(device.group, device.width),
    v: String(frameKey),
  });
  return `${PROXY_ENDPOINT}?${params.toString()}`;
}

// How much room the device shell adds around the screen itself. Shared by the
// renderer and the fit-to-stage zoom so the frame can never overshoot the stage.
function chromeMetrics(group: Group, width: number) {
  const phone = group === 'mobile' || (group === 'custom' && width < 600);
  const tablet = group === 'tablet' || (group === 'custom' && width >= 600 && width < 1024);
  const screenOnly = !phone && !tablet;

  const bezel = phone ? 9 : tablet ? 13 : 0;
  const capTop = phone ? 22 : tablet ? 16 : 0;
  const capBottom = phone ? 20 : tablet ? 16 : 0;
  const barHeight = screenOnly ? 30 : 0;
  const standHeight = screenOnly ? 26 : 0;

  return {
    phone, tablet, screenOnly, bezel, capTop, capBottom, barHeight, standHeight,
    extraWidth: bezel * 2,
    extraHeight: bezel * 2 + capTop + capBottom + barHeight + standHeight,
  };
}

function emptyReport(): Report {
  return { status: 'pending', overflow: false, clipped: false, overflowAmount: 0, viewportWidth: 0, documentWidth: 0, scrollHeight: 0, ghosts: 0, offenders: [], since: Date.now() };
}

function DeviceShell({
  device, url, rotated, scale, frameKey, report, serviceReady, popped, onTogglePopped, registerFrame,
}: {
  device: Device; url: string; rotated: boolean; scale: number; frameKey: number;
  report: Report; serviceReady: boolean; popped: boolean; onTogglePopped: () => void;
  registerFrame: (element: HTMLIFrameElement | null) => void;
}) {
  const width = rotated ? device.height : device.width;
  const height = rotated ? device.width : device.height;
  const metrics = chromeMetrics(device.group, device.width);
  const screenWidth = Math.round(width * scale);
  const screenHeight = Math.round(height * scale);
  const landscape = width > height;

  return (
    <div className="group/device relative flex flex-col items-center">
      {/* Hidden until hover so it never blocks a click on the page being tested. */}
      <button
        onClick={onTogglePopped}
        title={popped ? 'Close the popped-out view (Esc)' : 'Pop this device out over the page'}
        className="absolute right-2 top-2 z-20 inline-flex items-center gap-1.5 rounded-lg bg-slate-950/85 px-2.5 py-1.5 text-[11px] font-bold text-white opacity-0 shadow-lg backdrop-blur-sm transition group-hover/device:opacity-100 focus-visible:opacity-100"
        style={{ pointerEvents: 'auto' }}
      >
        {popped ? <><X className="h-3 w-3" />Close</> : <><Maximize2 className="h-3 w-3" />Pop out</>}
      </button>

      <div
        className={`relative ${metrics.screenOnly ? '' : 'bg-slate-900 shadow-2xl shadow-slate-900/25 ring-1 ring-slate-950/20'}`}
        style={{
          borderRadius: metrics.phone ? (landscape ? 30 : 34) : metrics.tablet ? 22 : 10,
          padding: metrics.bezel,
          paddingTop: metrics.bezel + metrics.capTop,
          paddingBottom: metrics.bezel + metrics.capBottom,
        }}
      >
        {metrics.phone && (
          <>
            {/* Dynamic island sits on the bezel strip, never over the page. */}
            <div className={`absolute rounded-full bg-slate-950 ${landscape ? 'left-[7px] top-1/2 h-[62px] w-[11px] -translate-y-1/2' : 'left-1/2 top-[7px] h-[11px] w-[68px] -translate-x-1/2'}`} />
            <div className={`absolute rounded-full bg-slate-700 ${landscape ? 'right-[6px] top-1/2 h-[84px] w-[4px] -translate-y-1/2' : 'bottom-[7px] left-1/2 h-[4px] w-[92px] -translate-x-1/2'}`} />
            {/* Proportional so the buttons stay on the shell at any zoom or orientation. */}
            <span className="absolute -left-[2px] top-[16%] h-[5%] w-[2px] rounded-l bg-slate-700" />
            <span className="absolute -left-[2px] top-[24%] h-[8%] w-[2px] rounded-l bg-slate-700" />
            <span className="absolute -right-[2px] top-[20%] h-[10%] w-[2px] rounded-r bg-slate-700" />
          </>
        )}
        {metrics.tablet && (
          <>
            <div className={`absolute h-[6px] w-[6px] rounded-full bg-slate-700 ${landscape ? 'left-[5px] top-1/2 -translate-y-1/2' : 'left-1/2 top-[5px] -translate-x-1/2'}`} />
            <span className="absolute -right-[2px] top-[70px] h-10 w-[2px] rounded-r bg-slate-700" />
          </>
        )}

        {metrics.screenOnly && (
          <div className="flex items-center gap-1.5 rounded-t-xl border border-b-0 border-slate-300 bg-gradient-to-b from-slate-100 to-slate-200 px-3" style={{ height: metrics.barHeight }}>
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="ml-2 min-w-0 flex-1 truncate rounded-md bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 shadow-inner">{url}</span>
          </div>
        )}

        <div
          className={`relative overflow-hidden bg-white ${metrics.screenOnly ? 'rounded-b-xl border border-slate-300' : ''}`}
          style={{
            width: screenWidth,
            height: screenHeight,
            borderRadius: metrics.phone ? (landscape ? 22 : 26) : metrics.tablet ? 10 : undefined,
          }}
        >
          {/* The frame is always the true device size; only the wrapper is scaled,
              so the page still lays out at exactly `width` CSS pixels. */}
          {serviceReady ? (
            <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left', willChange: 'transform' }}>
              <iframe
                key={`${device.id}-${rotated}-${frameKey}`}
                ref={registerFrame}
                title={`${device.label} preview of ${displayUrl(url)}`}
                src={frameSource(url, device, frameKey)}
                className="block border-0 bg-white"
                style={{ width, height }}
              />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-50 p-4 text-center">
              <p className="text-xs font-semibold text-slate-500">Preview service unavailable</p>
            </div>
          )}

          {report.status === 'pending' && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[3px] overflow-hidden bg-violet-100">
              <div className="h-full w-full animate-pulse bg-violet-500" />
            </div>
          )}
          {report.status === 'ready' && (report.overflow || report.clipped) && (
            <div
              className={`pointer-events-none absolute inset-0 ring-2 ring-inset ${report.overflow ? 'ring-rose-500/70' : 'ring-amber-500/70'}`}
              style={{ borderRadius: metrics.phone ? (landscape ? 22 : 26) : metrics.tablet ? 10 : undefined }}
            />
          )}
        </div>
      </div>

      {metrics.standHeight > 0 && (
        <div className="flex flex-col items-center">
          <div className="h-4 w-16 bg-gradient-to-b from-slate-300 to-slate-400" style={{ clipPath: 'polygon(18% 0, 82% 0, 100% 100%, 0 100%)' }} />
          <div className="h-[6px] w-40 rounded-b-md bg-slate-400" />
        </div>
      )}
    </div>
  );
}

export default function ResponsivePreview() {
  const [urlInput, setUrlInput] = useState('https://example.com');
  const [previewUrl, setPreviewUrl] = useState('https://example.com');
  const [urlError, setUrlError] = useState('');
  const [customDevices, setCustomDevices] = useState<Device[]>([]);
  const [deviceId, setDeviceId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(DEVICE_STORAGE_KEY);
      if (saved && DEVICE_LIBRARY.some((device) => device.id === saved)) return saved;
    } catch {
      // Ignore
    }
    return DEFAULT_DEVICE_ID;
  });
  const [rotated, setRotated] = useState(false);
  const [zoom, setZoom] = useState<'fit' | number>('fit');
  const [frameKey, setFrameKey] = useState(0);
  const [report, setReport] = useState<Report>(emptyReport);
  const [recentUrls, setRecentUrls] = useState<string[]>([]);
  const [customWidth, setCustomWidth] = useState('414');
  const [customHeight, setCustomHeight] = useState('896');
  const [serviceReady, setServiceReady] = useState<boolean | null>(null);
  const [sizeError, setSizeError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showOffenders, setShowOffenders] = useState(false);
  const [popped, setPopped] = useState(false);
  const poppedRef = useRef(false);

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const [stageWidth, setStageWidth] = useState(0);
  const [stageTop, setStageTop] = useState(0);
  const [windowHeight, setWindowHeight] = useState(() => window.innerHeight);

  const allDevices = useMemo(() => [...DEVICE_LIBRARY, ...customDevices], [customDevices]);
  const device = useMemo(
    () => allDevices.find((item) => item.id === deviceId)
      ?? DEVICE_LIBRARY.find((item) => item.id === DEFAULT_DEVICE_ID)!,
    [allDevices, deviceId],
  );
  const [category, setCategory] = useState<Group>(device.group);
  const [brand, setBrand] = useState<Brand>(device.brand ?? 'apple');

  const width = rotated ? device.height : device.width;
  const height = rotated ? device.width : device.height;

  const brandsInCategory = BRANDS_BY_GROUP[category];

  // Custom sizes carry no vendor, so the brand filter only bites in the
  // categories that actually offer vendor tabs.
  const devicesInScope = useMemo(
    () => allDevices.filter((item) => item.group === category
      && (BRANDS_BY_GROUP[category].length === 0 || item.brand === brand)),
    [allDevices, category, brand],
  );

  // A stale selection would leave the <select> showing a blank row, so fall
  // back to the first model in scope rather than rendering nothing.
  const selectedModelId = devicesInScope.some((item) => item.id === device.id)
    ? device.id
    : (devicesInScope[0]?.id ?? '');

  // The stage has to size itself against where it actually starts on screen,
  // not against a guessed offset — otherwise "Fit" fits the device to a box
  // that runs off the bottom of the window.
  const stageHeight = popped
    ? Math.max(300, windowHeight - POP_HEADER_HEIGHT)
    : Math.max(360, windowHeight - stageTop - 16);

  const fitScale = useMemo(() => {
    if (stageWidth === 0) return 1;
    const metrics = chromeMetrics(device.group, device.width);
    const availableWidth = stageWidth - 40 - metrics.extraWidth;
    const availableHeight = stageHeight - 32 - metrics.extraHeight;
    return Math.max(0.1, Math.min(1, availableWidth / width, availableHeight / height));
  }, [stageWidth, stageHeight, device.group, device.width, width, height]);

  const scale = zoom === 'fit' ? fitScale : zoom;

  const registerFrame = useCallback((element: HTMLIFrameElement | null) => {
    frameRef.current = element;
  }, []);

  const sendToFrame = useCallback((message: Record<string, unknown>) => {
    try { frameRef.current?.contentWindow?.postMessage({ source: 'rp-host', ...message }, '*'); } catch { /* frame gone */ }
  }, []);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    setStageWidth(element.clientWidth);
    const observer = new ResizeObserver((entries) => setStageWidth(entries[0].contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Track where the stage actually starts. The controls above it change height
  // when chips wrap or the culprit list expands, and the expand is animated —
  // so watch the controls box rather than re-measuring on state changes, which
  // would read a height that is still mid-animation.
  const measureStage = useCallback(() => {
    const stage = stageRef.current;
    // Popped out, the stage is fixed to the viewport and its offset means nothing.
    if (!stage || poppedRef.current) return;
    const top = stage.getBoundingClientRect().top + window.scrollY;
    setStageTop((current) => (Math.abs(current - top) > 1 ? top : current));
  }, []);

  useLayoutEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    measureStage();
    const observer = new ResizeObserver(measureStage);
    observer.observe(controls);
    window.addEventListener('resize', measureStage);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measureStage);
    };
  }, [measureStage]);

  useEffect(() => {
    const onResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => { poppedRef.current = popped; }, [popped]);

  useEffect(() => {
    if (!popped) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setPopped(false); };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [popped]);

  // While popped the stage is fixed at the top of the viewport, so its measured
  // offset is meaningless. Re-measure once it is back in the page flow.
  useEffect(() => {
    if (popped) return;
    const frame = requestAnimationFrame(measureStage);
    return () => cancelAnimationFrame(frame);
  }, [popped, measureStage]);

  // The probe injected by /api/responsive/proxy reports the real layout back.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object' || data.source !== 'rp-probe') return;
      if (data.frameId !== FRAME_ID) return;

      if (data.type === 'metrics') {
        setReport({
          status: 'ready',
          overflow: Boolean(data.overflow),
          clipped: Boolean(data.clipped),
          overflowAmount: Number(data.overflowAmount) || 0,
          viewportWidth: Number(data.viewportWidth) || 0,
          documentWidth: Number(data.documentWidth) || 0,
          scrollHeight: Number(data.scrollHeight) || 0,
          ghosts: Number(data.ghosts) || 0,
          offenders: Array.isArray(data.offenders) ? data.offenders : [],
          since: Date.now(),
        });
      } else if (data.type === 'error') {
        setReport({ ...emptyReport(), status: 'error', message: String(data.message || 'The page could not be loaded.') });
      } else if (data.type === 'navigate' && typeof data.url === 'string') {
        setUrlInput(data.url);
        setPreviewUrl(data.url);
        setReport(emptyReport());
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Anything that remounts the frame invalidates the measurement with it.
  useEffect(() => {
    setReport(emptyReport());
    setShowOffenders(false);
  }, [previewUrl, deviceId, rotated, frameKey]);

  // A frame that never reports back is unmeasured, which is not the same thing
  // as "no overflow" — say so rather than showing a false all-clear.
  useEffect(() => {
    if (report.status !== 'pending') return;
    const timer = setTimeout(() => {
      setReport((current) => (current.status === 'pending'
        ? { ...current, status: 'error', message: 'The page did not report back in time.' }
        : current));
    }, PROBE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [report.status, report.since]);

  // A server started before this route existed answers with the /api/* catch-all
  // JSON, which would otherwise just render as gibberish inside the device.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/responsive/status', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data) => { if (!cancelled) setServiceReady(Boolean(data?.ok)); })
      .catch(() => { if (!cancelled) setServiceReady(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (serviceReady === false) {
      setReport({ ...emptyReport(), status: 'error', message: 'Preview service is not running on this server.' });
    }
  }, [serviceReady]);

  useEffect(() => {
    try {
      const savedUrls = localStorage.getItem(RECENT_STORAGE_KEY);
      const parsed = savedUrls ? JSON.parse(savedUrls) : null;
      if (Array.isArray(parsed)) setRecentUrls(parsed.filter((item): item is string => typeof item === 'string'));
    } catch {
      // Ignore malformed or unavailable local storage.
    }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(DEVICE_STORAGE_KEY, deviceId); } catch { /* no-op */ }
  }, [deviceId]);

  useEffect(() => () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
  }, []);

  const saveRecent = (url: string) => {
    setRecentUrls((current) => {
      const next = [url, ...current.filter((item) => item !== url)].slice(0, MAX_RECENT_URLS);
      try { localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next)); } catch { /* no-op */ }
      return next;
    });
  };

  const preview = (value = urlInput) => {
    const normalized = normalizeUrl(value);
    if (!normalized) {
      setUrlError('Enter a valid http:// or https:// URL.');
      return;
    }
    setUrlError('');
    setUrlInput(normalized);
    setPreviewUrl(normalized);
    setFrameKey((current) => current + 1);
    saveRecent(normalized);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    preview();
  };

  const selectCategory = (group: Group) => {
    setCategory(group);
    if (group === 'custom') {
      const firstCustom = customDevices[0];
      if (firstCustom) { setDeviceId(firstCustom.id); setRotated(false); }
      return;
    }

    // Carry the vendor across when the new category also has it — hopping
    // Mobile -> Tablet should stay on Apple, not snap back to the first tab.
    const brands = BRANDS_BY_GROUP[group];
    const nextBrand = brands.includes(brand) ? brand : brands[0];
    setBrand(nextBrand);
    if (device.group !== group || device.brand !== nextBrand) {
      const first = allDevices.find((item) => item.group === group && item.brand === nextBrand);
      if (first) { setDeviceId(first.id); setRotated(false); }
    }
  };

  const selectBrand = (next: Brand) => {
    setBrand(next);
    const first = allDevices.find((item) => item.group === category && item.brand === next);
    if (first) { setDeviceId(first.id); setRotated(false); }
  };

  const applyCustomSize = () => {
    const nextWidth = Math.round(Number(customWidth));
    const nextHeight = Math.round(Number(customHeight));
    if (!Number.isFinite(nextWidth) || !Number.isFinite(nextHeight) || nextWidth < 120 || nextHeight < 120) {
      setSizeError('Width and height must both be at least 120px.');
      return;
    }
    setSizeError('');
    const id = `custom-${nextWidth}x${nextHeight}`;
    const custom: Device = { id, label: `${nextWidth} × ${nextHeight}`, width: nextWidth, height: nextHeight, group: 'custom' };
    setCustomDevices((current) => (current.some((item) => item.id === id) ? current : [...current, custom]));
    setCategory('custom');
    setRotated(false);
    setDeviceId(id);
  };

  const removeCustomDevice = (id: string) => {
    setCustomDevices((current) => current.filter((item) => item.id !== id));
    if (deviceId !== id) return;
    const nextCustom = customDevices.find((item) => item.id !== id);
    if (nextCustom) {
      setDeviceId(nextCustom.id);
    } else {
      // No custom sizes left, so follow the fallback device out of the tab too.
      const fallback = DEVICE_LIBRARY.find((item) => item.id === DEFAULT_DEVICE_ID)!;
      setDeviceId(fallback.id);
      setCategory(fallback.group);
      setBrand(fallback.brand ?? 'apple');
    }
    setRotated(false);
  };

  const removeRecent = (url: string) => {
    setRecentUrls((current) => {
      const next = current.filter((item) => item !== url);
      try { localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next)); } catch { /* no-op */ }
      return next;
    });
  };

  const clearRecent = () => {
    setRecentUrls([]);
    try { localStorage.removeItem(RECENT_STORAGE_KEY); } catch { /* no-op */ }
  };

  const handleShare = () => {
    copyText(previewUrl).then((ok) => {
      if (!ok) return;
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1500);
    });
  };

  const CategoryIcon = GROUP_META[category].icon;

  return (
    <div className="space-y-2.5 pb-3">
      <div ref={controlsRef} className="space-y-2.5">
      {serviceReady === false && (
        <section role="alert" className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 text-xs">
            <p className="font-bold text-amber-900">Preview service is not running on this server</p>
            <p className="mt-0.5 leading-relaxed text-amber-800">
              <code className="rounded bg-amber-100 px-1 font-mono">/api/responsive/proxy</code> returned a 404, so previews cannot load.
              The dev server does not reload <code className="rounded bg-amber-100 px-1 font-mono">server.ts</code> on its own — stop it and run{' '}
              <code className="rounded bg-amber-100 px-1 font-mono">npm run dev</code> again, then reload this page.
            </p>
          </div>
        </section>
      )}

      {/* URL bar */}
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="preview-url">Website URL</label>
          <input
            id="preview-url"
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            placeholder="example.com"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-100"
          />
          <button type="submit" className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2">
            Preview
          </button>
          <button type="button" onClick={() => setFrameKey((value) => value + 1)} title="Reload the preview" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"><RefreshCw className="h-3.5 w-3.5" />Reload</button>
          <button type="button" onClick={handleShare} title="Copy the preview URL" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Share2 className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Share'}
          </button>
          <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-slate-50 hover:text-violet-900">Open site <ExternalLink className="h-3.5 w-3.5" /></a>
        </form>
        {urlError && <p role="alert" className="mt-2 text-xs font-medium text-rose-600">{urlError}</p>}
      </section>

      {/* Device picker */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-3 py-2">
          {GROUP_ORDER.map((group) => {
            const Icon = GROUP_META[group].icon;
            const active = category === group;
            return (
              <button
                key={group}
                onClick={() => selectCategory(group)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${active ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {GROUP_META[group].label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          {category === 'custom' ? (
            <>
              <div className="flex items-center gap-1.5">
                <input type="number" min="120" value={customWidth} onChange={(event) => setCustomWidth(event.target.value)} aria-label="Custom width in pixels" className="w-20 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
                <span className="text-xs font-semibold text-slate-400">×</span>
                <input type="number" min="120" value={customHeight} onChange={(event) => setCustomHeight(event.target.value)} aria-label="Custom height in pixels" className="w-20 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
                <button onClick={applyCustomSize} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700">Apply</button>
              </div>
              {sizeError && <p role="alert" className="text-[11px] font-medium text-rose-600">{sizeError}</p>}

              {devicesInScope.length === 0 ? (
                <p className="py-1 text-xs text-slate-500">Enter a width and height to create a viewport. Sizes you apply are kept here for the session.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5 border-l border-slate-200 pl-2">
                  {devicesInScope.map((item) => {
                    const active = item.id === device.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => { setDeviceId(item.id); setRotated(false); }}
                        aria-pressed={active}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${active ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                      >
                        <span className="font-mono text-[11px]">{item.label}</span>
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`Remove ${item.label}`}
                          onClick={(event) => { event.stopPropagation(); removeCustomDevice(item.id); }}
                          onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); removeCustomDevice(item.id); } }}
                          className="rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <X className="h-3 w-3" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Vendor split. Widths differ enough between makers that picking
                  the maker first is the fastest way to the model you want. */}
              <div className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
                {brandsInCategory.map((item) => {
                  const active = item === brand;
                  return (
                    <button
                      key={item}
                      onClick={() => selectBrand(item)}
                      aria-pressed={active}
                      className={`rounded-md px-3 py-1 text-xs font-bold transition ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      {BRAND_LABEL[item]}
                    </button>
                  );
                })}
              </div>

              <div className="relative inline-flex min-w-0 flex-1 items-center rounded-lg border border-slate-200 sm:max-w-xs">
                <label className="sr-only" htmlFor="device-model">Device model</label>
                <select
                  id="device-model"
                  value={selectedModelId}
                  onChange={(event) => { setDeviceId(event.target.value); setRotated(false); }}
                  className="w-full cursor-pointer appearance-none truncate bg-transparent px-2.5 py-1.5 pr-7 text-xs font-semibold text-slate-800 outline-none"
                >
                  {devicesInScope.map((item) => (
                    <option key={item.id} value={item.id}>{item.label} — {item.width} × {item.height}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400" />
              </div>

              <span className="shrink-0 font-mono text-xs text-slate-500">{device.width} × {device.height}</span>
              <span className="shrink-0 text-[11px] text-slate-400">{devicesInScope.length} model{devicesInScope.length === 1 ? '' : 's'}</span>
            </>
          )}
        </div>
      </section>

      {/* Frame toolbar and overflow verdict, kept to one row so the stage gets
          the vertical space instead. */}
      <section className={`overflow-hidden rounded-xl border shadow-sm transition ${
        report.status === 'ready' && report.overflow ? 'border-rose-200'
          : report.status === 'ready' && report.clipped ? 'border-amber-200'
          : report.status === 'ready' ? 'border-emerald-200'
          : report.status === 'error' ? 'border-amber-200'
          : 'border-slate-200'
      } bg-white`}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><CategoryIcon className="h-3.5 w-3.5" /></span>
            <p className="truncate text-sm font-bold text-slate-900">{device.label}</p>
            <span className="shrink-0 font-mono text-xs text-slate-500">{width} × {height}</span>
            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-500">{Math.round(scale * 100)}%</span>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
            <span
              title={report.status === 'ready' && report.clipped
                ? 'Visible content reaches past the viewport, but the page does not scroll sideways — overflow-x: hidden on the root is masking it. iOS Safari can still pan this.'
                : report.status === 'ready' && !report.overflow && report.ghosts > 0
                ? `Nothing visible overflows. ${report.ghosts} transparent box${report.ghosts === 1 ? '' : 'es'} reach past the edge but paint no pixels, so they are ignored.`
                : undefined}
              className={`inline-flex min-w-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                report.status === 'ready' && report.overflow ? 'bg-rose-50 text-rose-700'
                  : report.status === 'ready' && report.clipped ? 'bg-amber-50 text-amber-700'
                  : report.status === 'ready' ? 'bg-emerald-50 text-emerald-700'
                  : report.status === 'error' ? 'bg-amber-50 text-amber-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {report.status === 'pending' ? <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin" />
                : report.status === 'error' ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                : report.overflow || report.clipped ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                : <CircleCheck className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">
                {report.status === 'pending' ? 'Measuring…'
                  : report.status === 'error' ? (report.message || 'Could not measure')
                  : report.overflow ? `Overflows by ${report.overflowAmount}px`
                  : report.clipped ? `Clipped ${report.overflowAmount}px past the edge`
                  : 'No horizontal overflow'}
              </span>
              {report.status === 'ready' && (report.overflow || report.clipped) && (
                <span className="hidden shrink-0 font-mono text-[10px] font-medium opacity-70 lg:inline">{report.documentWidth}px / {report.viewportWidth}px</span>
              )}
            </span>

            {report.status === 'ready' && (report.overflow || report.clipped) && report.offenders.length > 0 && (
              <button
                onClick={() => setShowOffenders((value) => !value)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${report.overflow ? 'border-rose-200 text-rose-700 hover:bg-rose-50' : 'border-amber-200 text-amber-700 hover:bg-amber-50'}`}
              >
                {showOffenders ? 'Hide' : `${report.offenders.length} culprit${report.offenders.length === 1 ? '' : 's'}`}
                <ChevronDown className={`h-3.5 w-3.5 transition ${showOffenders ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={() => setRotated((value) => !value)} title="Rotate the device" className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${rotated ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
              <RotateCw className="h-3.5 w-3.5" />{rotated ? 'Landscape' : 'Portrait'}
            </button>

            <div className="relative inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
              <ZoomIn className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={zoom === 'fit' ? 'fit' : String(zoom)}
                onChange={(event) => setZoom(event.target.value === 'fit' ? 'fit' : Number(event.target.value))}
                aria-label="Preview zoom"
                className="cursor-pointer appearance-none bg-transparent pr-4 outline-none"
              >
                <option value="fit">Fit</option>
                {ZOOM_STEPS.map((step) => <option key={step} value={step}>{Math.round(step * 100)}%</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 h-3 w-3 text-slate-400" />
            </div>

            <button onClick={() => setPopped(true)} title="Pop the device out over the page (Esc to close)" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"><Maximize2 className="h-3.5 w-3.5" />Pop out</button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {showOffenders && report.offenders.length > 0 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}>
              <ul className={`space-y-1 border-t bg-white px-3 py-2 ${report.overflow ? 'border-rose-200' : 'border-amber-200'}`}>
                {report.offenders.map((offender) => (
                  <li
                    key={`${offender.index}-${offender.selector}`}
                    onMouseEnter={() => sendToFrame({ type: 'highlight', index: offender.index })}
                    onMouseLeave={() => sendToFrame({ type: 'highlight', index: null })}
                    className={`flex flex-wrap items-baseline gap-x-2 rounded px-1.5 py-1 text-[11px] transition ${report.overflow ? 'hover:bg-rose-50' : 'hover:bg-amber-50'}`}
                  >
                    <code className="font-mono font-bold text-slate-800">{offender.selector}</code>
                    <span className={report.overflow ? 'text-rose-600' : 'text-amber-700'}>{offender.width}px wide · {offender.overhang}px past the edge</span>
                    {offender.ghost && <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-500">paints nothing</span>}
                    {offender.text && <span className="truncate text-slate-400">“{offender.text}”</span>}
                  </li>
                ))}
                <li className="px-1.5 pt-1 text-[11px] text-slate-500">Hover a selector to outline it inside the preview.</li>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
      </div>

      {/* Popped-out header. The stage below expands to fill the viewport rather
          than the device being re-rendered somewhere else — moving the iframe
          would reload it and throw away your scroll position in the page. */}
      <AnimatePresence>
        {popped && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-x-0 top-0 z-[70] flex items-center justify-between gap-3 border-b border-white/10 bg-slate-950 px-4 text-white"
            style={{ height: POP_HEADER_HEIGHT }}
          >
            <div className="flex min-w-0 items-center gap-2">
              <CategoryIcon className="h-4 w-4 shrink-0 text-slate-400" />
              <p className="truncate text-sm font-bold">{device.label}</p>
              <span className="shrink-0 font-mono text-xs text-slate-400">{width} × {height}</span>
              <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-300">{Math.round(scale * 100)}%</span>
              <span className="truncate text-xs text-slate-400">· {displayUrl(previewUrl)}</span>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <span className={`hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold sm:inline-flex ${
                report.status === 'ready' && report.overflow ? 'bg-rose-500/20 text-rose-200'
                  : report.status === 'ready' && report.clipped ? 'bg-amber-500/20 text-amber-200'
                  : report.status === 'ready' ? 'bg-emerald-500/20 text-emerald-200'
                  : 'bg-white/10 text-slate-300'
              }`}>
                {report.status === 'pending' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  : report.overflow || report.clipped ? <AlertTriangle className="h-3.5 w-3.5" />
                  : <CircleCheck className="h-3.5 w-3.5" />}
                {report.status === 'pending' ? 'Measuring…'
                  : report.overflow ? `Overflows by ${report.overflowAmount}px`
                  : report.clipped ? `Clipped ${report.overflowAmount}px`
                  : 'No horizontal overflow'}
              </span>
              <button onClick={() => setRotated((value) => !value)} title="Rotate" className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/20"><RotateCw className="h-3.5 w-3.5" />{rotated ? 'Landscape' : 'Portrait'}</button>
              <button onClick={() => setFrameKey((value) => value + 1)} title="Reload" className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/10 p-1.5 hover:bg-white/20"><RefreshCw className="h-3.5 w-3.5" /></button>
              <button onClick={() => setPopped(false)} title="Close (Esc)" className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/20"><X className="h-3.5 w-3.5" />Close</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stage */}
      <section
        ref={stageRef}
        onClick={(event) => { if (popped && event.target === event.currentTarget) setPopped(false); }}
        className={popped
          ? 'fixed inset-x-0 bottom-0 z-[60] flex items-start justify-center overflow-auto bg-slate-950/95 p-4'
          : 'flex items-start justify-center overflow-auto rounded-xl border border-slate-200 bg-slate-100 bg-[radial-gradient(circle_at_1px_1px,rgb(203_213_225)_1px,transparent_0)] p-4 [background-size:16px_16px]'}
        style={popped ? { top: POP_HEADER_HEIGHT, height: stageHeight } : { height: stageHeight }}
      >
        <motion.div layout transition={{ type: 'spring', stiffness: 320, damping: 34 }}>
          <DeviceShell
            device={device}
            url={previewUrl}
            rotated={rotated}
            scale={scale}
            frameKey={frameKey}
            report={report}
            serviceReady={serviceReady !== false}
            popped={popped}
            onTogglePopped={() => setPopped((value) => !value)}
            registerFrame={registerFrame}
          />
        </motion.div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-900">Recently tested</p>
            <p className="text-xs text-slate-500">Your last {MAX_RECENT_URLS} previews, stored on this device.</p>
          </div>
          {recentUrls.length > 0 && <button onClick={clearRecent} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" />Clear</button>}
        </div>
        {recentUrls.length === 0 ? (
          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Your recently previewed sites will appear here.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {recentUrls.map((url) => (
              <li key={url} className="flex min-w-0 items-center gap-2 py-2">
                <button onClick={() => preview(url)} className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-700 hover:text-violet-700">{url}</button>
                <Check className={url === previewUrl ? 'h-3.5 w-3.5 shrink-0 text-violet-600' : 'hidden'} />
                <button onClick={() => removeRecent(url)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600" title={`Remove ${url}`}><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
