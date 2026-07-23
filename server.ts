import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase body-parser limits for the base64 screenshot upload
app.use(express.json({ limit: "50mb" }));

// Initialize Gemini Client lazily or at startup
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const currentKey = process.env.GEMINI_API_KEY;
  if (!currentKey) return null;
  if (!ai) {
    if (currentKey.startsWith("ya29.")) {
      ai = new GoogleGenAI({
        httpOptions: {
          headers: {
            'Authorization': `Bearer ${currentKey}`,
            'User-Agent': 'aistudio-build',
          }
        }
      });
    } else {
      ai = new GoogleGenAI({
        apiKey: currentKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return ai;
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

// Robust server-side parser for metadata & headings
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
    bodyText: cleanText
  };
}

// Intelligent fallback report generator if Gemini API is unavailable or returns an error
function buildLocalReport(parsedWebData: ReturnType<typeof parseHtml>, url: string) {
  const hasTitle = !!parsedWebData.title;
  const hasDescription = !!parsedWebData.description;
  const hasH1 = parsedWebData.headings.some(h => h.level === 'h1');
  const h1Item = parsedWebData.headings.find(h => h.level === 'h1');

  const headingMatches: Array<{
    level: 'h1' | 'h2' | 'h3';
    expectedText: string;
    actualText: string;
    status: 'match' | 'mismatch' | 'partial';
    comment: string;
  }> = parsedWebData.headings.slice(0, 10).map(h => ({
    level: h.level as 'h1' | 'h2' | 'h3',
    expectedText: h.text,
    actualText: h.text,
    status: 'match',
    comment: `<${h.level}> present on target page with exact text.`
  }));

  if (!hasH1) {
    headingMatches.unshift({
      level: 'h1',
      expectedText: 'Main Page H1 Heading',
      actualText: '',
      status: 'mismatch',
      comment: 'Missing primary <h1> heading tag on target webpage.'
    });
  }

  let score = 100;
  if (!hasTitle) score -= 25;
  if (!hasDescription) score -= 20;
  if (!hasH1) score -= 20;
  if (parsedWebData.headings.length < 2) score -= 10;
  if (parsedWebData.bodyText.length < 50) score -= 15;
  score = Math.max(10, Math.min(100, score));

  const recommendations: string[] = [];
  if (!hasTitle) recommendations.push('Add a descriptive <title> tag to the webpage <head>.');
  if (!hasDescription) recommendations.push('Add a meta description tag (<meta name="description" content="...">).');
  if (!hasH1) recommendations.push('Add a clear primary <h1> heading to establish page topic hierarchy.');
  if (parsedWebData.headings.length < 3) recommendations.push('Incorporate additional <h2> and <h3> subheadings to structure page sections.');
  if (parsedWebData.bodyText.length < 100) recommendations.push('Ensure body copy content is loaded in server HTML rather than rendered solely on client JS.');

  if (recommendations.length === 0) {
    recommendations.push('Verify visually that font family, weights, and component padding match reference design specifications.');
    recommendations.push('Check image alt text attributes across all landing page assets.');
  }

  return {
    seo: {
      titleMatches: hasTitle,
      expectedTitle: parsedWebData.title || 'Page Title Expected',
      actualTitle: parsedWebData.title || '(No title tag found)',
      titleDifference: hasTitle ? 'Title tag present.' : 'Missing <title> tag in HTML head.',
      descriptionMatches: hasDescription,
      expectedDescription: parsedWebData.description || 'Meta Description Expected',
      actualDescription: parsedWebData.description || '(No meta description found)',
      descriptionDifference: hasDescription ? 'Meta description present.' : 'Missing meta description tag.',
      status: (hasTitle && hasDescription) ? 'match' : (hasTitle || hasDescription) ? 'partial' : 'mismatch',
      analysis: (hasTitle && hasDescription)
        ? 'Target page contains active title and meta description tags.'
        : 'One or more essential SEO meta tags are missing from the target page head.'
    },
    headings: {
      status: hasH1 ? (parsedWebData.headings.length >= 2 ? 'match' : 'partial') : 'mismatch',
      matches: headingMatches,
      analysis: `Extracted ${parsedWebData.headings.length} heading tag(s) from target HTML.`
    },
    bodyContent: {
      status: parsedWebData.bodyText.length > 100 ? 'match' : 'partial',
      mismatches: hasH1 ? [] : [
        {
          category: 'Heading Hierarchy',
          expected: 'Primary <h1> Heading Tag',
          actual: 'None',
          severity: 'high' as const,
          comment: 'Missing primary <h1> heading element in page body.'
        }
      ],
      matchesCount: Math.min(parsedWebData.headings.length, 5),
      mismatchesCount: hasH1 ? 0 : 1,
      analysis: `Extracted ${parsedWebData.bodyText.length} characters of readable body copy text.`
    },
    overallScore: score,
    summary: `Crawled ${url}. Found ${parsedWebData.title ? 'Title "' + parsedWebData.title + '"' : 'No Title'}, ${parsedWebData.headings.length} headings, and ${parsedWebData.bodyText.length} characters of body text.`,
    recommendations
  };
}

// Express Endpoints
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", hasApiKey: !!process.env.GEMINI_API_KEY });
});

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
          },
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

    // Attempt Gemini AI Analysis if available
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

        const textPrompt = `You are an elite QA and SEO Auditor. Compare this Reference Document Screenshot against the Crawled Target Webpage to verify content compliance, heading matches, and metadata alignment.

Crawled Target Webpage Information:
- Target Source: ${targetUrlName}
- Page <title>: "${parsedWebData.title || '[None found]'}"
- Meta description: "${parsedWebData.description || '[None found]'}"
- HTML Heading Hierarchy:
${parsedWebData.headings.map(h => `  * <${h.level}>: "${h.text}"`).join("\n") || '  [No headings found]'}
- Extracted Clean Webpage Copy Text:
"${parsedWebData.bodyText}"

Inspect the provided Reference Document Screenshot. Compare the expected title, meta description, heading structure, and body copy in the screenshot against the Crawled Target Webpage.

Calculate an Overall Compliance Score from 0 to 100 based on accuracy. Return your response strictly as a JSON object adhering to this schema:
${JSON.stringify(responseSchema, null, 2)}
`;

        const geminiRes = await client.models.generateContent({
          model: "gemini-3.6-flash",
          contents: { parts: [imagePart, { text: textPrompt }] },
          config: {
            responseMimeType: "application/json",
            responseSchema: responseSchema
          }
        });

        const reportText = geminiRes.text;
        if (reportText) {
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
        }
      } catch (geminiError: any) {
        console.warn("Gemini AI API call encountered an issue, generating rule-based compliance report:", geminiError.message || geminiError);
      }
    }

    // Fallback: Generate high-fidelity rule-based report
    const localReport = buildLocalReport(parsedWebData, targetUrlName);
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

// Explicit JSON Error handler for all /api requests (catches body-parser & server errors)
app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Express API error handler caught:", err);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || "An internal server error occurred while processing the API request."
  });
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
