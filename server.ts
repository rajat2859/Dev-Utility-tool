import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import Tesseract from "tesseract.js";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase body-parser limits for the base64 screenshot upload
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Gemini Client lazily or at startup
function getGeminiClient(): GoogleGenAI | null {
  const currentKey = process.env.GEMINI_API_KEY;
  if (!currentKey || currentKey.trim() === "") return null;
  if (currentKey.startsWith("ya29.")) {
    // Avoid sending unsupported OAuth tokens as standard API key headers
    return null;
  }
  return new GoogleGenAI({
    apiKey: currentKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Structured output schema for the analysis report
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    seo: {
      type: Type.OBJECT,
      properties: {
        titleMatches: { type: Type.BOOLEAN },
        expectedTitle: { type: Type.STRING },
        actualTitle: { type: Type.STRING },
        titleDifference: { type: Type.STRING },
        descriptionMatches: { type: Type.BOOLEAN },
        expectedDescription: { type: Type.STRING },
        actualDescription: { type: Type.STRING },
        descriptionDifference: { type: Type.STRING },
        status: { type: Type.STRING }, // "match", "partial", "mismatch"
        analysis: { type: Type.STRING }
      },
      required: [
        "titleMatches", "expectedTitle", "actualTitle", "titleDifference",
        "descriptionMatches", "expectedDescription", "actualDescription",
        "descriptionDifference", "status", "analysis"
      ]
    },
    headings: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING }, // "match", "partial", "mismatch"
        matches: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              level: { type: Type.STRING }, // "h1", "h2", "h3", "h4"
              expectedText: { type: Type.STRING },
              actualText: { type: Type.STRING },
              status: { type: Type.STRING }, // "match", "partial", "mismatch"
              comment: { type: Type.STRING }
            },
            required: ["level", "expectedText", "actualText", "status", "comment"]
          }
        },
        analysis: { type: Type.STRING }
      },
      required: ["status", "matches", "analysis"]
    },
    bodyContent: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING }, // "match", "partial", "mismatch"
        mismatches: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              expected: { type: Type.STRING },
              actual: { type: Type.STRING },
              severity: { type: Type.STRING }, // "high", "medium", "low"
              comment: { type: Type.STRING }
            },
            required: ["category", "expected", "actual", "severity", "comment"]
          }
        },
        matchesCount: { type: Type.INTEGER },
        mismatchesCount: { type: Type.INTEGER },
        analysis: { type: Type.STRING }
      },
      required: ["status", "mismatches", "matchesCount", "mismatchesCount", "analysis"]
    },
    overallScore: { type: Type.INTEGER }, // 0 to 100
    summary: { type: Type.STRING },
    recommendations: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    }
  },
  required: ["seo", "headings", "bodyContent", "overallScore", "summary", "recommendations"]
};

// Robust server-side parser for metadata, headings, paragraphs, lists, and tables
function parseHtml(html: string) {
  // Extract title (standard <title>, og:title, twitter:title)
  let title = '';
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    title = titleMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  } else {
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([\s\S]*?)["']/i) ||
                         html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+property=["']og:title["']/i);
    if (ogTitleMatch) {
      title = ogTitleMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }
  }

  // Extract meta description
  let description = '';
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i) ||
                    html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["']/i) ||
                    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["']/i) ||
                    html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+property=["']og:description["']/i) ||
                    html.match(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([\s\S]*?)["']/i);
  if (descMatch) {
    description = descMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  // Extract headers: h1 through h6
  const headings: { level: string; text: string }[] = [];
  const headingRegex = /<(h1|h2|h3|h4|h5|h6)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    const level = match[1].toLowerCase();
    const text = match[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (text) {
      headings.push({ level, text });
    }
  }

  // Extract explicit <p> paragraph tags
  const paragraphs: string[] = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pMatch;
  while ((pMatch = pRegex.exec(html)) !== null) {
    const pText = pMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (pText) {
      paragraphs.push(pText);
    }
  }

  // Extract List items (<li>)
  const listItems: string[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let liMatch;
  while ((liMatch = liRegex.exec(html)) !== null) {
    const liText = liMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (liText) {
      listItems.push(liText);
    }
  }

  // Extract Tables (<table>, <tr>, <th>, <td>)
  const tables: { headers: string[]; rows: string[][] }[] = [];
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tableMatch[1];
    const headers: string[] = [];
    const rows: string[][] = [];

    const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
    let thMatch;
    while ((thMatch = thRegex.exec(tableHtml)) !== null) {
      const thText = thMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      if (thText) headers.push(thText);
    }

    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch;
    while ((trMatch = trRegex.exec(tableHtml)) !== null) {
      const trHtml = trMatch[1];
      const rowCells: string[] = [];
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let tdMatch;
      while ((tdMatch = tdRegex.exec(trHtml)) !== null) {
        const tdText = tdMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        if (tdText) rowCells.push(tdText);
      }
      if (rowCells.length > 0) {
        rows.push(rowCells);
      }
    }

    if (headers.length > 0 || rows.length > 0) {
      tables.push({ headers, rows });
    }
  }

  // Extract body copy text (strip script, style, comments and tags)
  let cleanText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
  cleanText = cleanText.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
  cleanText = cleanText.replace(/<!--[\s\S]*?-->/g, ' ');
  cleanText = cleanText.replace(/<[^>]*>/g, ' ');
  cleanText = cleanText.replace(/\s+/g, ' ').trim();

  if (cleanText.length > 15000) {
    cleanText = cleanText.substring(0, 15000) + '... [truncated]';
  }

  return {
    title,
    description,
    headings,
    paragraphs,
    listItems,
    tables,
    bodyText: cleanText
  };
}

// Local OCR helper for server-side text extraction from reference screenshots
async function performLocalOcr(imageBase64: string): Promise<string> {
  try {
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(cleanBase64, 'base64');
    const result = await Tesseract.recognize(imageBuffer, 'eng');
    return result?.data?.text || '';
  } catch (err: any) {
    console.log("Local OCR extraction note:", err?.message || err);
    return '';
  }
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
}

function stringSimilarity(s1: string, s2: string): number {
  const norm1 = s1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const norm2 = s2.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!norm1 && !norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;
  if (norm1 === norm2) return 1.0;

  const len1 = norm1.length;
  const len2 = norm2.length;
  // Fast length check optimization
  if (Math.abs(len1 - len2) / Math.max(len1, len2) > 0.6) {
    return 0.3;
  }

  const matrix: number[][] = [];
  for (let i = 0; i <= len1; i++) matrix[i] = [i];
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = norm1[i - 1] === norm2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return 1 - distance / maxLen;
}

function findBestOcrMatch(targetText: string, ocrLines: string[], fullOcrText: string): { bestText: string; similarity: number } {
  const normTarget = normalizeText(targetText);
  if (!normTarget) return { bestText: '', similarity: 1.0 };

  const normFullOcr = normalizeText(fullOcrText);
  if (normFullOcr.includes(normTarget)) {
    return { bestText: targetText, similarity: 1.0 };
  }

  let bestText = '';
  let highestSim = 0;

  for (const line of ocrLines) {
    const normLine = normalizeText(line);
    if (!normLine) continue;
    const sim = stringSimilarity(targetText, line);
    if (sim > highestSim) {
      highestSim = sim;
      bestText = line;
    }
  }

  if (normTarget.length > 25 && ocrLines.length > 1) {
    for (let i = 0; i < ocrLines.length - 1; i++) {
      const combined = ocrLines[i] + ' ' + ocrLines[i + 1];
      const sim = stringSimilarity(targetText, combined);
      if (sim > highestSim) {
        highestSim = sim;
        bestText = combined;
      }
    }
  }

  return { bestText: bestText || 'Reference document text', similarity: highestSim };
}

// Intelligent OCR-powered local compliance report generator
async function buildLocalReport(
  parsedWebData: ReturnType<typeof parseHtml>,
  url: string,
  imageBase64?: string
) {
  let ocrText = '';
  if (imageBase64) {
    ocrText = await performLocalOcr(imageBase64);
  }

  const cleanOcr = normalizeText(ocrText);
  const ocrLines = ocrText.split('\n').map(l => l.trim()).filter(l => l.length > 3);

  const hasTitle = !!parsedWebData.title;
  const hasDescription = !!parsedWebData.description;
  const hasH1 = parsedWebData.headings.some(h => h.level === 'h1');

  const mismatches: Array<{
    category: string;
    expected: string;
    actual: string;
    severity: 'high' | 'medium' | 'low';
    comment: string;
  }> = [];

  let score = 100;
  let matchesCount = 0;

  // 1. Title verification against screenshot OCR
  let titleMatches = hasTitle;
  let titleDifference = hasTitle ? 'Title tag present.' : 'Missing <title> tag in HTML head.';
  if (hasTitle && imageBase64) {
    if (cleanOcr.length > 10) {
      const { bestText, similarity } = findBestOcrMatch(parsedWebData.title, ocrLines, ocrText);
      if (similarity < 0.85) {
        titleMatches = false;
        titleDifference = `Webpage title ("${parsedWebData.title}") was not found verbatim in reference screenshot.`;
        mismatches.push({
          category: 'Page Title Mismatch',
          expected: bestText,
          actual: parsedWebData.title,
          severity: 'medium',
          comment: `Webpage <title> ("${parsedWebData.title}") differs from reference document screenshot.`
        });
        score -= 15;
      } else {
        matchesCount++;
      }
    } else {
      mismatches.push({
        category: 'Page Title Verification',
        expected: 'Title as shown in screenshot',
        actual: parsedWebData.title,
        severity: 'low',
        comment: 'Reference screenshot contained no legible title text matching the webpage.'
      });
      score -= 10;
    }
  }

  // 2. Explicit Paragraph (<p>) Verification against Reference Document Screenshot OCR
  if (parsedWebData.paragraphs.length > 0 && imageBase64) {
    if (cleanOcr.length > 10) {
      parsedWebData.paragraphs.forEach((pText, idx) => {
        if (pText.length > 8) {
          const { bestText, similarity } = findBestOcrMatch(pText, ocrLines, ocrText);
          if (similarity < 0.85) {
            mismatches.push({
              category: 'Paragraph Copy Mismatch',
              expected: bestText,
              actual: pText,
              severity: 'high',
              comment: `Paragraph #${idx + 1} (<p>) on target webpage ("${pText.substring(0, 90)}...") differs from reference document screenshot.`
            });
            score -= 20;
          } else {
            matchesCount++;
          }
        }
      });
    } else {
      parsedWebData.paragraphs.slice(0, 3).forEach((pText, idx) => {
        mismatches.push({
          category: 'Paragraph Copy Mismatch',
          expected: 'Text from document screenshot',
          actual: pText,
          severity: 'high',
          comment: `Paragraph #${idx + 1} on webpage ("${pText.substring(0, 80)}...") was not found in the reference document screenshot.`
        });
        score -= 20;
      });
    }
  }

  // 3. Bullet & List Item (<li>) Verification
  if (parsedWebData.listItems.length > 0 && imageBase64) {
    if (cleanOcr.length > 10) {
      parsedWebData.listItems.forEach((liText, idx) => {
        if (liText.length > 5) {
          const { bestText, similarity } = findBestOcrMatch(liText, ocrLines, ocrText);
          if (similarity < 0.85) {
            mismatches.push({
              category: 'List Item Mismatch',
              expected: bestText,
              actual: liText,
              severity: 'medium',
              comment: `List item #${idx + 1} (<li>) on webpage ("${liText}") differs from reference document screenshot.`
            });
            score -= 15;
          } else {
            matchesCount++;
          }
        }
      });
    } else {
      parsedWebData.listItems.slice(0, 3).forEach((liText, idx) => {
        mismatches.push({
          category: 'List Item Mismatch',
          expected: 'List item from document screenshot',
          actual: liText,
          severity: 'medium',
          comment: `List item #${idx + 1} (<li>) on webpage was not found in reference document screenshot.`
        });
        score -= 15;
      });
    }
  }

  // 4. Table Header & Row Cells Verification
  if (parsedWebData.tables.length > 0 && imageBase64) {
    if (cleanOcr.length > 10) {
      parsedWebData.tables.forEach((table, tIdx) => {
        table.headers.forEach((hdr) => {
          const { bestText, similarity } = findBestOcrMatch(hdr, ocrLines, ocrText);
          if (similarity < 0.85) {
            mismatches.push({
              category: 'Table Header Mismatch',
              expected: bestText,
              actual: hdr,
              severity: 'medium',
              comment: `Table #${tIdx + 1} header ("${hdr}") differs from reference screenshot.`
            });
            score -= 15;
          } else {
            matchesCount++;
          }
        });

        table.rows.forEach((row, rIdx) => {
          row.forEach((cell, cIdx) => {
            if (cell.length > 2) {
              const { bestText, similarity } = findBestOcrMatch(cell, ocrLines, ocrText);
              if (similarity < 0.85) {
                mismatches.push({
                  category: 'Table Cell Mismatch',
                  expected: bestText,
                  actual: cell,
                  severity: 'medium',
                  comment: `Table #${tIdx + 1} row ${rIdx + 1}, cell ${cIdx + 1} ("${cell}") differs from reference screenshot.`
                });
                score -= 10;
              } else {
                matchesCount++;
              }
            }
          });
        });
      });
    }
  }

  // 5. Heading Verification
  const headingMatches = parsedWebData.headings.slice(0, 10).map((h) => {
    let status: 'match' | 'mismatch' | 'partial' = 'match';
    let comment = `<${h.level}> present on target page with exact text.`;

    if (imageBase64) {
      if (cleanOcr.length > 10) {
        const { bestText, similarity } = findBestOcrMatch(h.text, ocrLines, ocrText);
        if (similarity < 0.85) {
          status = 'mismatch';
          comment = `<${h.level}> text ("${h.text}") does not match reference document screenshot.`;
          mismatches.push({
            category: 'Heading Mismatch',
            expected: bestText,
            actual: `<${h.level}>: "${h.text}"`,
            severity: 'medium',
            comment: `<${h.level}> heading on target webpage differs from reference screenshot.`
          });
          score -= 15;
        } else {
          matchesCount++;
        }
      } else {
        status = 'mismatch';
        comment = `<${h.level}> heading on webpage was not found in reference screenshot.`;
        mismatches.push({
          category: 'Heading Mismatch',
          expected: 'Heading in screenshot',
          actual: `<${h.level}>: "${h.text}"`,
          severity: 'medium',
          comment: `<${h.level}> heading on webpage was not found in reference screenshot.`
        });
        score -= 15;
      }
    }

    return {
      level: h.level as 'h1' | 'h2' | 'h3',
      expectedText: h.text,
      actualText: h.text,
      status,
      comment
    };
  });

  if (!hasH1) {
    headingMatches.unshift({
      level: 'h1',
      expectedText: 'Main Page H1 Heading',
      actualText: 'None',
      status: 'mismatch',
      comment: 'Missing primary <h1> heading tag on target webpage.'
    });
    score -= 20;
  }

  if (!hasTitle) score -= 25;
  if (!hasDescription) score -= 20;
  score = Math.max(0, Math.min(100, score));

  const recommendations: string[] = [];
  if (mismatches.length > 0) {
    recommendations.push('Align modified paragraph copy, headings, list items, and table cells on webpage with the reference document screenshot.');
  }
  if (!hasTitle) recommendations.push('Add a descriptive <title> tag to the webpage <head>.');
  if (!hasDescription) recommendations.push('Add a meta description tag (<meta name="description" content="...">).');
  if (!hasH1) recommendations.push('Add a clear primary <h1> heading to establish page topic hierarchy.');
  if (parsedWebData.headings.length < 3) recommendations.push('Incorporate additional <h2> and <h3> subheadings to structure page sections.');

  if (recommendations.length === 0) {
    recommendations.push('Verify visually that font family, weights, and component padding match reference design specifications.');
    recommendations.push('Check image alt text attributes across all landing page assets.');
  }

  const bodyStatus = mismatches.length > 0 ? 'mismatch' : (parsedWebData.bodyText.length > 100 ? 'match' : 'partial');

  return {
    seo: {
      titleMatches,
      expectedTitle: parsedWebData.title || 'Page Title Expected',
      actualTitle: parsedWebData.title || '(No title tag found)',
      titleDifference,
      descriptionMatches: hasDescription,
      expectedDescription: parsedWebData.description || 'Meta Description Expected',
      actualDescription: parsedWebData.description || '(No meta description found)',
      descriptionDifference: hasDescription ? 'Meta description present.' : 'Missing meta description tag.',
      status: (titleMatches && hasDescription) ? 'match' : (titleMatches || hasDescription) ? 'partial' : 'mismatch',
      analysis: (titleMatches && hasDescription)
        ? 'Target page contains active title and meta description tags.'
        : 'SEO tags or title content discrepancies detected.'
    },
    headings: {
      status: hasH1 && headingMatches.every(m => m.status === 'match') ? 'match' : 'mismatch',
      matches: headingMatches,
      analysis: `Extracted ${parsedWebData.headings.length} heading tag(s) from target HTML.`
    },
    bodyContent: {
      status: bodyStatus,
      mismatches,
      matchesCount,
      mismatchesCount: mismatches.length,
      analysis: mismatches.length > 0
        ? `Found ${mismatches.length} content discrepancy(ies) across paragraphs, headings, lists, or tables.`
        : `Extracted ${parsedWebData.bodyText.length} characters of copy text; all elements matched reference screenshot.`
    },
    overallScore: score,
    summary: `Analyzed ${url}. OCR Extracted ${ocrLines.length} text line(s) from screenshot. Found ${mismatches.length} copy discrepancy(ies). Overall score: ${score}%.`,
    recommendations
  };
}

// Express Endpoints
app.get("/api/health", (req, res) => {
  const hasGemini = !!process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith("ya29.");
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
  res.json({
    status: "ok",
    hasApiKey: hasGemini || hasOpenRouter,
    provider: hasGemini ? "Gemini API" : (hasOpenRouter ? "OpenRouter API" : "Local OCR Engine")
  });
});

async function analyzeWithOpenRouter(openRouterKey: string, textPrompt: string, imageBase64: string): Promise<string | null> {
  try {
    const dataUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`;
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterKey.trim()}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL || "https://ai.studio",
        "X-Title": "SEO Copy Auditor"
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: dataUrl } },
              { type: "text", text: textPrompt }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      console.log("OpenRouter API response status:", response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch (err: any) {
    console.log("OpenRouter API exception:", err?.message || err);
    return null;
  }
}

app.post("/api/content-checker/analyze", async (req, res) => {
  try {
    const { url, rawHtml, image } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Missing reference document screenshot image." });
    }

    let htmlContent = "";
    let targetUrlName = url || "Provided HTML Source";

    if (rawHtml && rawHtml.trim()) {
      htmlContent = rawHtml.trim();
    } else if (url && url.trim()) {
      let sanitizedUrl = url.trim();
      if (!/^https?:\/\//i.test(sanitizedUrl)) {
        sanitizedUrl = 'https://' + sanitizedUrl;
      }
      targetUrlName = sanitizedUrl;

      try {
        const response = await fetch(sanitizedUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ContentChecker/1.0",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache"
          },
          cache: "no-store",
          signal: AbortSignal.timeout(12000), // 12 second timeout
        });

        if (!response.ok) {
          return res.status(400).json({ 
            error: `Failed to fetch target URL. Website returned status: ${response.status} ${response.statusText}` 
          });
        }

        htmlContent = await response.text();
      } catch (fetchErr: any) {
        console.error("Error fetching URL:", fetchErr);
        return res.status(400).json({ 
          error: `Could not connect to target URL (${sanitizedUrl}). Details: ${fetchErr.message || fetchErr}. Make sure the URL is public or use "Paste HTML/Copy" mode.` 
        });
      }
    } else {
      return res.status(400).json({ error: "Please provide either a Target URL or Raw HTML/Copy text." });
    }

    // Parse extracted HTML content
    const parsedWebData = parseHtml(htmlContent);

    // Attempt Gemini AI or OpenRouter AI Analysis if available
    let reportText = "";
    const textPrompt = `You are a strict QA and SEO Content Compliance Auditor.
Your task is to perform an exact visual and textual OCR comparison between the Reference Document Screenshot provided and the Crawled Target Webpage HTML/text below.

Crawled Target Webpage Information:
- Target Source: ${targetUrlName}
- Page <title>: "${parsedWebData.title || '[None found]'}"
- Meta description: "${parsedWebData.description || '[None found]'}"
- HTML Heading Hierarchy:
${parsedWebData.headings.map(h => `  * <${h.level}>: "${h.text}"`).join("\n") || '  [No headings found]'}
- Extracted Paragraphs (<p> tags in order):
${parsedWebData.paragraphs.length > 0 ? parsedWebData.paragraphs.map((p, idx) => `  * <p> #${idx + 1}: "${p}"`).join("\n") : '  [No explicit <p> tags found]'}
- Extracted Bullet/Numbered List Items (<li> tags in order):
${parsedWebData.listItems.length > 0 ? parsedWebData.listItems.map((li, idx) => `  * <li> #${idx + 1}: "${li}"`).join("\n") : '  [No list items found]'}
- Extracted HTML Tables (Headers & Rows):
${parsedWebData.tables.length > 0 ? parsedWebData.tables.map((tbl, idx) => `  * Table #${idx + 1}:\n    - Headers: ${tbl.headers.join(' | ') || 'None'}\n    - Rows:\n${tbl.rows.map(r => `      [ ${r.join(' | ')} ]`).join('\n')}`).join("\n") : '  [No tables found]'}
- Full Extracted Body Copy Text:
"${parsedWebData.bodyText}"

CRITICAL COMPARISON MANDATE:
1. Examine the Reference Document Screenshot image in high detail. Read every title, heading, paragraph (<p>), list item (<li>), table cell (<td>/<th>), and sentence shown in the document screenshot.
2. Compare the text in the document screenshot word-for-word against the Crawled Target Webpage headings, paragraphs (<p>), list items (<li>), tables, and copy text provided above.
3. ABSOLUTE ACCURACY IS REQUIRED FOR ALL ELEMENTS: Check every heading, paragraph (<p>), list item (<li>), and table cell. If any sentence, word, number, header, table cell, or bullet point in the webpage copy differs from what is shown in the reference screenshot (e.g., modified text, changed <p> or <li> tag contents, altered table data, missing words, extra sections, or rephrased copy), YOU MUST DETECT AND REPORT IT AS A MISMATCH.
4. If there are ANY paragraph (<p>), list item (<li>), table, heading, or copy differences:
   - Do NOT mark bodyContent.status as 'match'. Set it to 'mismatch' or 'partial'.
   - List EVERY copy mismatch in 'bodyContent.mismatches', specifying:
     * category: "Paragraph Copy Mismatch" (or "List Item Mismatch" / "Table Data Mismatch" / "Heading Mismatch" / "Title Mismatch")
     * expected: The exact text as seen in the reference document screenshot
     * actual: The actual text found on the webpage
     * severity: "high" for altered or missing sentences/paragraphs/tables, "medium" for minor word/punctuation differences
     * comment: Detailed description of what changed in the tag/cell/paragraph between the document screenshot and the webpage.
   - Set 'bodyContent.mismatchesCount' to the number of discrepancies found.
   - Lower the 'overallScore' proportionally (e.g. deduct 15-30 points per mismatch).
   - NEVER give an overallScore of 100 if the webpage copy, paragraphs, list items, or tables do not match the document screenshot 100% exactly word-for-word!

Calculate the Overall Compliance Score (0 to 100) based on strict copy alignment. Return your response strictly as a JSON object adhering to this schema:
${JSON.stringify(responseSchema, null, 2)}
`;

    // 1. Try Gemini API if client available
    const client = getGeminiClient();
    if (client) {
      try {
        const base64Data = image.split(',')[1] || image;
        let mimeType = "image/png";
        const mimeMatch = image.match(/^data:(image\/[a-zA-Z+]+);base64,/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
        }

        const imagePart = {
          inlineData: {
            mimeType,
            data: base64Data
          }
        };

        try {
          const geminiRes = await client.models.generateContent({
            model: "gemini-3.6-flash",
            contents: { parts: [imagePart, { text: textPrompt }] },
            config: {
              responseMimeType: "application/json",
              responseSchema: responseSchema
            }
          });
          reportText = geminiRes.text || "";
        } catch (modelErr: any) {
          console.log("Gemini 3.6 Flash unavailable, trying fallback model...");
          try {
            const fallbackRes = await client.models.generateContent({
              model: "gemini-flash-latest",
              contents: { parts: [imagePart, { text: textPrompt }] },
              config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema
              }
            });
            reportText = fallbackRes.text || "";
          } catch (fallbackErr: any) {
            console.log("Gemini API call note: proceeding to alternative providers/OCR engine.");
          }
        }
      } catch (geminiError: any) {
        console.log("Gemini API note: Executing fallback providers.");
      }
    }

    // 2. Try OpenRouter API if GEMINI failed or was missing, and OPENROUTER_API_KEY is available
    if (!reportText && process.env.OPENROUTER_API_KEY) {
      console.log("Attempting OpenRouter AI analysis...");
      const openRouterResult = await analyzeWithOpenRouter(process.env.OPENROUTER_API_KEY, textPrompt, image);
      if (openRouterResult) {
        reportText = openRouterResult;
      }
    }

    // 3. Return structured AI report if any AI provider succeeded
    if (reportText) {
      try {
        const parsedReport = JSON.parse(reportText.trim());
        return res.json({
          success: true,
          report: parsedReport,
          webpageData: {
            title: parsedWebData.title,
            description: parsedWebData.description,
            headingsCount: parsedWebData.headings.length
          }
        });
      } catch (e) {
        console.log("AI response parsing note, falling back to OCR engine.");
      }
    }

    // Fallback: Generate high-fidelity OCR rule-based report
    const localReport = await buildLocalReport(parsedWebData, targetUrlName, image);
    return res.json({
      success: true,
      report: localReport,
      webpageData: {
        title: parsedWebData.title,
        description: parsedWebData.description,
        headingsCount: parsedWebData.headings.length
      }
    });

  } catch (error: any) {
    console.error("Analysis route error:", error);
    return res.status(500).json({ 
      error: `Internal server analysis failure: ${error.message || error}` 
    });
  }
});

// Endpoint to resolve Awesome Screenshot and other image sharing pages to Base64
app.post("/api/content-checker/resolve-awesome-screenshot", async (req, res) => {
  try {
    let { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Missing share link URL." });
    }

    url = url.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    let imageUrl = "";

    // If it's a direct image link
    if (/\.(png|jpe?g|webp|gif)(?:\?.*)?$/i.test(url)) {
      imageUrl = url;
    } else {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return res.status(400).json({ error: `Could not fetch shared link. Status: ${response.status} ${response.statusText}` });
      }

      const html = await response.text();

      // Look for standard open graph or twitter image meta tags first
      const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i) ||
                      html.match(/<meta[^>]+name=["']twitter:image:src["'][^>]+content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image:src["']/i);

      if (ogMatch) {
        imageUrl = ogMatch[1];
      } else if (twMatch) {
        imageUrl = twMatch[1];
      } else {
        const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
        let match;
        while ((match = imgRegex.exec(html)) !== null) {
          const src = match[1];
          if (src.includes("awesomescreenshot") || src.includes("screenshot") || src.includes("cdn") || src.includes("storage") || src.includes("amazonaws")) {
            imageUrl = src;
            break;
          }
        }

        if (!imageUrl) {
          const fallbackMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
          if (fallbackMatch) {
            imageUrl = fallbackMatch[1];
          }
        }
      }
    }

    if (!imageUrl) {
      return res.status(400).json({ error: "Could not locate a high-fidelity image on the shared screenshot link page. Make sure the link is public." });
    }

    imageUrl = imageUrl.replace(/&amp;/g, '&');
    
    // Resolve relative URL if needed
    try {
      imageUrl = new URL(imageUrl, url).href;
    } catch (e) {
      // Keep as is
    }

    const imgResponse = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!imgResponse.ok) {
      return res.status(400).json({ error: `Failed to download screenshot image from resolved URL: ${imageUrl}` });
    }

    const arrayBuffer = await imgResponse.arrayBuffer();
    const contentType = imgResponse.headers.get("content-type") || "image/png";
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:${contentType};base64,${base64}`;

    return res.json({
      success: true,
      imageUrl,
      base64: dataUrl
    });

  } catch (err: any) {
    console.error("Resolve screenshot error:", err);
    return res.status(500).json({ error: `Failed to resolve shared link: ${err.message || err}` });
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
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

setupFrontend();
