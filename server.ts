import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import Tesseract from "tesseract.js";
import compression from "compression";
import { contentAuditRouter } from "./server/content-auditor/routes/contentAuditRoutes";
import { runSeoAudit } from "./server/seo-audit/crawl";
import {
  isPrivateIp,
  fetchWithSafeRedirects,
  readBodyCapped,
  UnsafeUrlError,
  validateSafeUrl,
} from "./server/content-auditor/webpage/PageSecurity";
import { webkit, type Browser } from "playwright-core";

dotenv.config();

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (server kept alive):', err);
});

const app = express();
const PORT = Number(process.env.PORT) || 2000;

app.use(compression());

app.use("/api/content-checker", express.json({ limit: "50mb" }));
app.use("/api/seo-checker", express.json({ limit: "10mb" }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ limit: "2mb", extended: true }));

// Browser-like User-Agent for fetching target pages
const DESKTOP_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed;
}

const MAX_SEO_HTML_BYTES = 10 * 1024 * 1024; // 10MB
async function fetchWebpageHtml(targetUrl: string): Promise<{ html: string; notice?: string }> {
  const sanitizedUrl = normalizeUrl(targetUrl);

  const browserHeaders = {
    "User-Agent": DESKTOP_USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1"
  };

  try {
    const { response: res } = await fetchWithSafeRedirects(sanitizedUrl, {
      headers: browserHeaders,
      signal: AbortSignal.timeout(10000),
    });

    const text = (await readBodyCapped(res, MAX_SEO_HTML_BYTES)).toString("utf8");
    if (text && text.trim().length > 30) {
      return { html: text };
    }
  } catch (err: any) {
    if (err instanceof UnsafeUrlError) throw err;
    console.warn(`Direct fetch failed for ${sanitizedUrl}:`, err.message || err);
  }

  throw new Error(`Could not retrieve HTML from target URL (${sanitizedUrl}). The target site may be blocking automated crawlers. Try using "Paste Raw HTML" mode.`);
}

async function fetchGoogleDocText(docUrl: string): Promise<string> {
  const idMatch = docUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (!idMatch) {
    throw new Error('That does not look like a Google Docs URL (expected .../document/d/<id>/...).');
  }
  const docId = idMatch[1];
  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;

  const res = await fetch(exportUrl, { redirect: 'follow', signal: AbortSignal.timeout(10000) });
  if (!res.ok) {
    throw new Error(
      res.status === 401 || res.status === 403
        ? 'This Google Doc is not public. Set sharing to "Anyone with the link" and try again.'
        : `Could not fetch Google Doc (status ${res.status}).`
    );
  }

  const text = (await res.text()).trim();
  if (!text || text.length < 5) {
    throw new Error('Google Doc appears to be empty.');
  }
  return text;
}

app.post("/api/seo-checker/crawl", async (req, res) => {
  try {
    const { urls, rawHtml } = req.body ?? {};
    const urlList: string[] = Array.isArray(urls)
      ? urls.filter((u): u is string => typeof u === "string").map((u) => u.trim()).filter(Boolean)
      : [];
    const pastedHtml = typeof rawHtml === "string" ? rawHtml : "";

    if (!urlList.length && !pastedHtml.trim()) {
      return res.status(400).json({ error: "Enter at least one URL or sitemap URL, or paste raw HTML code." });
    }

    const result = await runSeoAudit({ urls: urlList, rawHtml: pastedHtml }, async (url) => (await fetchWebpageHtml(url)).html);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to audit SEO and Schemas." });
  }
});

app.use("/api/content-checker", contentAuditRouter);

// Express Endpoints
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    provider: "Local OCR Engine"
  });
});



// ---------------------------------------------------------------------------
// Responsive preview proxy
// ---------------------------------------------------------------------------

const RESPONSIVE_UA: Record<string, string> = {
  mobile:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  tablet:
    "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  desktop:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

const ALLOW_PRIVATE_PREVIEW_HOSTS = process.env.NODE_ENV !== "production";

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toJsLiteral(value: string): string {
  return JSON.stringify(String(value));
}

function buildPreviewProbe(frameId: string, realUrl: string, uaKey: string, interceptLinks = true): string {
  const userAgent = RESPONSIVE_UA[uaKey] || RESPONSIVE_UA.desktop;
  const touch = uaKey === "mobile" || uaKey === "tablet";

  const script = String.raw`
(function () {
  var FRAME_ID = __FRAME_ID__;
  var REAL_URL = __REAL_URL__;
  var UA_KEY = __UA_KEY__;
  var UA = __UA__;
  var TOUCH = __TOUCH__;
  var INTERCEPT_LINKS = __INTERCEPT_LINKS__;

  try {
    Object.defineProperty(navigator, "userAgent", { get: function () { return UA; }, configurable: true });
    Object.defineProperty(navigator, "appVersion", { get: function () { return UA.replace("Mozilla/", ""); }, configurable: true });
    if (TOUCH) {
      Object.defineProperty(navigator, "maxTouchPoints", { get: function () { return 5; }, configurable: true });
      Object.defineProperty(navigator, "platform", { get: function () { return UA_KEY === "tablet" ? "iPad" : "iPhone"; }, configurable: true });
      if (!("ontouchstart" in window)) { window.ontouchstart = null; }
    }
  } catch (e) {}

  try {
    var real = new URL(REAL_URL);
    if (real.origin !== location.origin) {
      var toLocal = function (url) {
        if (url == null) return url;
        var resolved = new URL(url, document.baseURI || REAL_URL);
        return resolved.origin === real.origin ? location.origin + resolved.pathname + resolved.search + resolved.hash : url;
      };
      ["pushState", "replaceState"].forEach(function (name) {
        var original = history[name];
        history[name] = function (state, title, url) {
          var local = url;
          try { local = toLocal(url); } catch (e) {}
          return original.call(this, state, title, local);
        };
      });
      history.replaceState(history.state, "", real.pathname + real.search + real.hash);
    }
  } catch (e) {}

  try { document.documentElement.setAttribute("data-rp-probe", "ready"); } catch (e) {}

  function post(message) {
    message.source = "rp-probe";
    message.frameId = FRAME_ID;
    try { parent.postMessage(message, "*"); } catch (e) {}
  }

  function cssPath(el) {
    var parts = [];
    var node = el;
    var depth = 0;
    while (node && node.nodeType === 1 && depth < 4) {
      var part = node.tagName.toLowerCase();
      if (node.id) { parts.unshift(part + "#" + node.id); break; }
      var classes = (node.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (classes.length) { part += "." + classes.join("."); }
      parts.unshift(part);
      node = node.parentElement;
      depth++;
    }
    return parts.join(" > ");
  }

  var offenderNodes = [];

  var REPLACED = {
    IMG: 1, VIDEO: 1, CANVAS: 1, SVG: 1, IFRAME: 1, EMBED: 1, OBJECT: 1,
    INPUT: 1, SELECT: 1, TEXTAREA: 1, BUTTON: 1, HR: 1,
  };

  function isTransparent(color) {
    if (!color || color === "transparent") return true;
    var parts = color.match(/rgba?\(([^)]+)\)/);
    if (!parts) return false;
    var bits = parts[1].split(",");
    return bits.length > 3 && parseFloat(bits[3]) === 0;
  }

  function hasVisibleBorder(style) {
    var sides = ["Top", "Right", "Bottom", "Left"];
    for (var i = 0; i < sides.length; i++) {
      var lineStyle = style["border" + sides[i] + "Style"];
      if (lineStyle === "none" || lineStyle === "hidden") continue;
      if (parseFloat(style["border" + sides[i] + "Width"]) <= 0) continue;
      if (isTransparent(style["border" + sides[i] + "Color"])) continue;
      return true;
    }
    return false;
  }

  function paintsInk(el, style) {
    if (REPLACED[el.tagName]) return true;
    if (style.backgroundImage && style.backgroundImage !== "none") return true;
    if (!isTransparent(style.backgroundColor)) return true;
    if (style.boxShadow && style.boxShadow !== "none") return true;
    if (hasVisibleBorder(style)) return true;
    if (style.outlineStyle && style.outlineStyle !== "none"
      && parseFloat(style.outlineWidth) > 0 && !isTransparent(style.outlineColor)) return true;
    return false;
  }

  function textInk(el) {
    var span = null;
    for (var i = 0; i < el.childNodes.length; i++) {
      var node = el.childNodes[i];
      if (node.nodeType !== 3 || !/\S/.test(node.nodeValue)) continue;
      var range = document.createRange();
      range.selectNodeContents(node);
      var rects = range.getClientRects();
      for (var r = 0; r < rects.length; r++) {
        var box = rects[r];
        if (box.width <= 0 || box.height <= 0) continue;
        if (!span) span = { left: box.left, right: box.right };
        if (box.left < span.left) span.left = box.left;
        if (box.right > span.right) span.right = box.right;
      }
    }
    return span;
  }

  function hiddenByAncestor(el) {
    var node = el.parentElement;
    while (node) {
      var style = window.getComputedStyle(node);
      if (style.display === "none") return true;
      if (style.visibility === "hidden" || style.visibility === "collapse") return true;
      if (parseFloat(style.opacity) === 0) return true;
      if (style.contentVisibility === "hidden") return true;
      node = node.parentElement;
    }
    return false;
  }

  function clippingAncestor(el) {
    var node = el.parentElement;
    while (node) {
      if (window.getComputedStyle(node).overflowX !== "visible") return node;
      node = node.parentElement;
    }
    return null;
  }

  function describe(item, index, viewportWidth, rtl) {
    return {
      index: index,
      selector: cssPath(item.el),
      tag: item.el.tagName.toLowerCase(),
      ghost: Boolean(item.ghost),
      width: Math.round(item.rect.width),
      overhang: Math.round(rtl ? -item.inkLeft : item.inkRight - viewportWidth),
      text: (item.el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 70)
    };
  }

  function deepestOnly(list) {
    return list.filter(function (candidate) {
      return !list.some(function (other) { return other.el !== candidate.el && candidate.el.contains(other.el); });
    }).slice(0, 20);
  }

  function scan() {
    var docEl = document.documentElement;
    var body = document.body;
    if (!docEl || !body) return;

    var viewportWidth = docEl.clientWidth || window.innerWidth;
    var rtl = window.getComputedStyle(docEl).direction === "rtl";
    var scrollWidth = docEl.scrollWidth;
    var scrolls = scrollWidth - viewportWidth > 1;

    var unclipped = [];
    var rootClipped = [];
    var maxOverhang = 0;
    var ghostEntries = [];

    var nodes = body.querySelectorAll("*");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.hasAttribute("data-rp-overlay")) continue;
      var rect = el.getBoundingClientRect();
      if (rect.width <= 0 && rect.height <= 0) continue;
      var right = rect.right + window.scrollX;
      var left = rect.left + window.scrollX;
      if (right <= viewportWidth + 1 && left >= -1) continue;
      var style = window.getComputedStyle(el);
      if (style.position === "fixed") continue;
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (parseFloat(style.opacity) === 0) continue;
      if (style.contentVisibility === "hidden") continue;
      if (hiddenByAncestor(el)) continue;

      var inkLeft = Infinity;
      var inkRight = -Infinity;
      if (rect.width > 0 && rect.height > 0 && paintsInk(el, style)) {
        inkLeft = left;
        inkRight = right;
      }
      var words = textInk(el);
      if (words) {
        if (words.left + window.scrollX < inkLeft) inkLeft = words.left + window.scrollX;
        if (words.right + window.scrollX > inkRight) inkRight = words.right + window.scrollX;
      }
      var overhang = inkRight === -Infinity ? -1 : (rtl ? -inkLeft : inkRight - viewportWidth);
      if (overhang <= 1) {
        var boxOverhang = rtl ? -left : right - viewportWidth;
        var ghostClipper = boxOverhang > 1 ? clippingAncestor(el) : null;
        if (boxOverhang > 1 && ghostEntries.length < 20
          && (!ghostClipper || ghostClipper === docEl || ghostClipper === body)) {
          ghostEntries.push({ el: el, rect: rect, right: right, left: left, inkRight: right, inkLeft: left, ghost: true });
        }
        continue;
      }

      var clipper = clippingAncestor(el);
      var entry = { el: el, rect: rect, right: right, left: left, inkRight: inkRight, inkLeft: inkLeft };
      if (!clipper) {
        unclipped.push(entry);
      } else if (clipper === docEl || clipper === body) {
        rootClipped.push(entry);
      } else {
        continue;
      }
      if (overhang > maxOverhang) maxOverhang = overhang;
    }

    var primary = deepestOnly(unclipped.length ? unclipped : rootClipped);
    if (!primary.length && scrolls && ghostEntries.length) primary = deepestOnly(ghostEntries);
    offenderNodes = primary.map(function (item) { return item.el; });

    var contentWidth = scrolls ? scrollWidth : Math.round(viewportWidth + maxOverhang);
    var overflowAmount = Math.max(0, Math.round(contentWidth - viewportWidth));
    var clipped = !scrolls && primary.length > 0 && overflowAmount > 0;

    post({
      type: "metrics",
      viewportWidth: viewportWidth,
      documentWidth: contentWidth,
      overflow: scrolls,
      clipped: clipped,
      overflowAmount: overflowAmount,
      scrollHeight: Math.round(Math.max(docEl.scrollHeight, body.scrollHeight)),
      viewportHeight: docEl.clientHeight || window.innerHeight,
      title: document.title || "",
      url: REAL_URL,
      ghosts: ghostEntries.length,
      offenders: primary.map(function (item, index) { return describe(item, index, viewportWidth, rtl); })
    });
  }

  var scanTimer = null;
  function scheduleScan(delay) {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(function () { scanTimer = null; scan(); }, delay || 250);
  }

  var overlay = null;
  function highlight(index) {
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.setAttribute("data-rp-overlay", "1");
      overlay.style.cssText = "position:absolute;z-index:2147483647;pointer-events:none;border:2px solid #e11d48;background:rgba(225,29,72,0.16);border-radius:2px;";
      (document.body || document.documentElement).appendChild(overlay);
    }
    var el = (index === null || index === undefined) ? null : offenderNodes[index];
    if (!el) { overlay.style.display = "none"; return; }
    var rect = el.getBoundingClientRect();
    overlay.style.display = "block";
    overlay.style.top = (rect.top + window.scrollY) + "px";
    overlay.style.left = (rect.left + window.scrollX) + "px";
    overlay.style.width = rect.width + "px";
    overlay.style.height = rect.height + "px";
  }

  var suppressScrollEcho = false;
  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.source !== "rp-host") return;
    if (data.type === "rescan") {
      scan();
    } else if (data.type === "highlight") {
      try { highlight(data.index); } catch (e) {}
    } else if (data.type === "scroll") {
      var docEl = document.documentElement;
      var max = Math.max(0, Math.max(docEl.scrollHeight, document.body.scrollHeight) - (docEl.clientHeight || window.innerHeight));
      suppressScrollEcho = true;
      window.scrollTo(0, Math.round(data.ratio * max));
      setTimeout(function () { suppressScrollEcho = false; }, 80);
    }
  });

  var scrollQueued = false;
  window.addEventListener("scroll", function () {
    if (suppressScrollEcho || scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(function () {
      scrollQueued = false;
      var docEl = document.documentElement;
      var max = Math.max(1, Math.max(docEl.scrollHeight, document.body.scrollHeight) - (docEl.clientHeight || window.innerHeight));
      post({ type: "scroll", ratio: Math.min(1, (window.scrollY || 0) / max) });
    });
  }, { passive: true });

  document.addEventListener("click", function (event) {
    if (!INTERCEPT_LINKS) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    var anchor = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!anchor) return;
    if (anchor.target && anchor.target !== "_self") return;
    var raw = anchor.getAttribute("href") || "";
    if (/^(mailto:|tel:|javascript:|#)/i.test(raw)) return;
    var absolute;
    try { absolute = new URL(anchor.href, REAL_URL).href; } catch (e) { return; }
    if (!/^https?:/i.test(absolute)) return;
    event.preventDefault();
    post({ type: "navigate", url: absolute });
  }, true);

  try {
    if (INTERCEPT_LINKS && window.navigation) {
      navigation.addEventListener("navigate", function (event) {
        if (!event.cancelable || event.downloadRequest || event.navigationType === "traverse") return;
        var dest = new URL(event.destination.url);
        if (dest.origin === location.origin || !/^https?:/.test(dest.protocol)) return;
        event.preventDefault();
        if (dest.href.split("#")[0] !== REAL_URL.split("#")[0]) post({ type: "navigate", url: dest.href });
      });
    }
  } catch (e) {}

  window.addEventListener("resize", function () { scheduleScan(120); });
  document.addEventListener("DOMContentLoaded", function () { scan(); });
  window.addEventListener("load", function () { scan(); });

  [80, 500, 1200, 2500, 4500].forEach(function (delay) { setTimeout(scan, delay); });
  var settleTimer = setInterval(scan, 1500);
  setTimeout(function () { clearInterval(settleTimer); }, 20000);

  try {
    var sizeObserver = new ResizeObserver(function () { scheduleScan(250); });
    var watchBody = function () {
      if (!document.body) { setTimeout(watchBody, 50); return; }
      sizeObserver.observe(document.body);
      sizeObserver.observe(document.documentElement);
    };
    watchBody();
  } catch (e) {}

  try {
    var observer = new MutationObserver(function () { scheduleScan(400); });
    var start = function () {
      if (!document.body) { setTimeout(start, 50); return; }
      observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "class", "width", "src"] });
    };
    start();
  } catch (e) {}
})();
`;

  return script
    .replace("__FRAME_ID__", toJsLiteral(frameId))
    .replace("__REAL_URL__", toJsLiteral(realUrl))
    .replace("__UA_KEY__", toJsLiteral(uaKey))
    .replace("__UA__", toJsLiteral(userAgent))
    .replace("__TOUCH__", String(touch))
    .replace("__INTERCEPT_LINKS__", String(interceptLinks));
}

function buildPreviewErrorPage(frameId: string, targetUrl: string, message: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;height:100%;font:500 13px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;background:#0f172a;color:#e2e8f0}
    .wrap{height:100%;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center}
    a{color:#c4b5fd}
  </style></head><body><div class="wrap"><div>
    <p style="font-weight:700;margin:0 0 6px">Could not load this page</p>
    <p style="margin:0 0 10px;color:#94a3b8">${escapeHtmlAttribute(message)}</p>
    <a href="${escapeHtmlAttribute(targetUrl)}" target="_blank" rel="noreferrer">Open directly</a>
  </div></div>
  <script>try{parent.postMessage({source:"rp-probe",frameId:${toJsLiteral(frameId)},type:"error",message:${toJsLiteral(message)}},"*")}catch(e){}</script>
  </body></html>`;
}

app.get("/api/responsive/status", (req, res) => {
  res.json({ ok: true, allowsPrivateHosts: ALLOW_PRIVATE_PREVIEW_HOSTS, userAgents: RESPONSIVE_UA });
});

app.get("/api/responsive/probe.js", (req, res) => {
  const uaKey = ["mobile", "tablet", "desktop"].includes(String(req.query.ua)) ? String(req.query.ua) : "desktop";
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(buildPreviewProbe(String(req.query.fid || "frame"), String(req.query.url || ""), uaKey, false));
});

app.get("/api/responsive/proxy", async (req, res) => {
  const rawUrl = String(req.query.url || "").trim();
  const frameId = String(req.query.fid || "frame");
  const uaKey = ["mobile", "tablet", "desktop"].includes(String(req.query.ua)) ? String(req.query.ua) : "desktop";

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
  res.removeHeader("X-Frame-Options");

  let target: URL;
  try {
    target = new URL(rawUrl);
    if (!["http:", "https:"].includes(target.protocol)) throw new Error("unsupported protocol");
  } catch {
    res.status(400).send(buildPreviewErrorPage(frameId, rawUrl || "about:blank", "That is not a valid http(s) URL."));
    return;
  }

  if (!ALLOW_PRIVATE_PREVIEW_HOSTS && isPrivateIp(target.hostname)) {
    res.status(403).send(buildPreviewErrorPage(frameId, target.href, "Previewing private network addresses is disabled on this server."));
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const upstreamInit: RequestInit = {
      signal: controller.signal,
      headers: {
        "user-agent": RESPONSIVE_UA[uaKey],
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "upgrade-insecure-requests": "1",
      },
    };
    let upstream: Response;
    let upstreamUrl: string;
    if (ALLOW_PRIVATE_PREVIEW_HOSTS) {
      upstream = await fetch(target.href, { ...upstreamInit, redirect: "follow" });
      upstreamUrl = upstream.url || target.href;
    } else {
      const safe = await fetchWithSafeRedirects(target.href, upstreamInit);
      upstream = safe.response;
      upstreamUrl = safe.finalUrl;
    }

    const contentType = upstream.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      res.status(415).send(buildPreviewErrorPage(frameId, target.href, `This URL returned ${contentType || "a non-HTML response"}.`));
      return;
    }

    const finalUrl = upstreamUrl;
    let html = await upstream.text();

    if (!upstream.ok && html.trim().length < 40) {
      res.status(502).send(buildPreviewErrorPage(frameId, target.href, `The site responded with HTTP ${upstream.status}.`));
      return;
    }

    html = html.replace(/<meta[^>]+http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi, "");

    let baseHref = finalUrl;
    const existingBase = html.match(/<base[^>]*\shref\s*=\s*["']([^"']+)["'][^>]*>/i);
    if (existingBase) {
      try { baseHref = new URL(existingBase[1], finalUrl).href; } catch { baseHref = finalUrl; }
    }
    html = html.replace(/<base[^>]*>/gi, "");

    const injection =
      `<base href="${escapeHtmlAttribute(baseHref)}">` +
      `<style>html{scrollbar-width:none!important;-ms-overflow-style:none!important}html::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}</style>` +
      `<script data-rp-probe>${buildPreviewProbe(frameId, finalUrl, uaKey)}</script>`;

    const headOpen = html.match(/<head[^>]*>/i);
    if (headOpen) {
      html = html.replace(headOpen[0], headOpen[0] + injection);
    } else if (/<html[^>]*>/i.test(html)) {
      html = html.replace(/<html[^>]*>/i, (match) => `${match}<head>${injection}</head>`);
    } else {
      html = injection + html;
    }

    res.status(200).send(html);
  } catch (error: any) {
    if (error instanceof UnsafeUrlError) {
      res.status(403).send(buildPreviewErrorPage(frameId, target.href, "Previewing private network addresses is disabled on this server."));
      return;
    }
    const message = error?.name === "AbortError" ? "The site took too long to respond." : (error?.message || "Network request failed.");
    res.status(502).send(buildPreviewErrorPage(frameId, target.href, message));
  } finally {
    clearTimeout(timeout);
  }
});

// ---------------------------------------------------------------------------
// WebKit render
// ---------------------------------------------------------------------------

const WEBKIT_DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const WEBKIT_MAX_PAGE_HEIGHT = 8000;

let webkitBrowser: Promise<Browser> | null = null;
function getWebkitBrowser(): Promise<Browser> {
  if (!webkitBrowser) {
    const launching = webkit.launch();
    webkitBrowser = launching;
    launching
      .then((browser) => browser.on("disconnected", () => { webkitBrowser = null; }))
      .catch(() => { webkitBrowser = null; });
  }
  return webkitBrowser;
}

app.get("/api/responsive/webkit", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const width = Math.round(Number(req.query.w));
  const height = Math.round(Number(req.query.h));
  const uaKey = ["mobile", "tablet", "desktop"].includes(String(req.query.ua)) ? String(req.query.ua) : "desktop";

  if (!(width >= 120 && width <= 4000 && height >= 120 && height <= 4000)) {
    res.status(400).json({ error: "Width and height must be between 120 and 4000." });
    return;
  }

  let target: URL;
  try {
    target = new URL(String(req.query.url || ""));
    if (!["http:", "https:"].includes(target.protocol)) throw new Error("unsupported protocol");
  } catch {
    res.status(400).json({ error: "That is not a valid http(s) URL." });
    return;
  }

  if (!ALLOW_PRIVATE_PREVIEW_HOSTS && isPrivateIp(target.hostname)) {
    res.status(403).json({ error: "Previewing private network addresses is disabled on this server." });
    return;
  }

  const touch = uaKey !== "desktop";
  let context: Awaited<ReturnType<Browser["newContext"]>> | null = null;
  try {
    const browser = await getWebkitBrowser();
    context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: touch ? 2 : 1,
      isMobile: touch,
      hasTouch: touch,
      userAgent: touch ? RESPONSIVE_UA[uaKey] : WEBKIT_DESKTOP_UA,
    });

    if (!ALLOW_PRIVATE_PREVIEW_HOSTS) {
      await context.route("**/*", async (route) => {
        const requestUrl = route.request().url();
        let allowed = false;
        try {
          allowed = /^(data|blob|about):/i.test(requestUrl) || (await validateSafeUrl(requestUrl)).valid;
        } catch {}
        try {
          if (allowed) await route.continue();
          else await route.abort("blockedbyclient");
        } catch {}
      });
    }

    const page = await context.newPage();
    await page.goto(target.href, { waitUntil: "domcontentloaded", timeout: 20000 });
    try { await page.waitForLoadState("networkidle", { timeout: 4000 }); } catch {}

    await page.evaluate(async (maxHeight) => {
      const step = window.innerHeight;
      for (let y = 0; y < Math.min(document.documentElement.scrollHeight, maxHeight); y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      window.scrollTo(0, 0);
      await new Promise((resolve) => setTimeout(resolve, 400));
    }, WEBKIT_MAX_PAGE_HEIGHT);

    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const screenshot = await page.screenshot({
      type: "jpeg",
      quality: 80,
      fullPage: true,
      clip: { x: 0, y: 0, width, height: Math.max(height, Math.min(pageHeight, WEBKIT_MAX_PAGE_HEIGHT)) },
    });

    res.setHeader("Content-Type", "image/jpeg");
    res.send(screenshot);
  } catch (error: any) {
    const message = String(error?.message || error);
    if (/Executable doesn't exist/i.test(message)) {
      res.status(503).json({ error: "WebKit is not installed. Run: npx playwright-core install webkit" });
    } else {
      res.status(502).json({ error: /Timeout/i.test(message) ? "The site took too long to load in WebKit." : message.split("\n")[0] });
    }
  } finally {
    await context?.close().catch(() => {});
  }
});

// Explicit JSON 404 Catch-All for any unhandled /api route
app.all("/api/*", (req: express.Request, res: express.Response) => {
  res.status(404).json({
    error: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

// Explicit JSON Error handler for all /api requests (catches body-parser & server errors)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Express API error handler caught:", err);
  const statusCode = err.status || err.statusCode || 500;
  if (req.originalUrl && req.originalUrl.startsWith("/api")) {
    return res.status(statusCode).json({
      error: err.message || "An internal server error occurred while processing the API request."
    });
  }
  next(err);
});

// Setup Vite Dev server middleware OR serve production static files
async function setupFrontend() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.startsWith(path.join(distPath, 'assets') + path.sep)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'no-cache');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, process.env.HOST || "127.0.0.1", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

setupFrontend();
