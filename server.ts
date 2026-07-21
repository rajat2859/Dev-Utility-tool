import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase body-parser limits for the base64 screenshot upload
app.use(express.json({ limit: "15mb" }));

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  if (apiKey.startsWith("ya29.")) {
    ai = new GoogleGenAI({
      httpOptions: {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'aistudio-build',
        }
      }
    });
  } else {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
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
              level: { type: Type.STRING }, // "h1", "h2", "h3"
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

// Simple server-side regex parser for metadata & headings
function parseHtml(html: string) {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';

  // Extract meta description
  let description = '';
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i) ||
                    html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["']/i) ||
                    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["']/i) ||
                    html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+property=["']og:description["']/i);
  if (descMatch) {
    description = descMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  // Extract headers: h1, h2, h3
  const headings: { level: string; text: string }[] = [];
  const headingRegex = /<(h1|h2|h3)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    const level = match[1].toLowerCase();
    const text = match[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (text) {
      headings.push({ level, text });
    }
  }

  // Extract body copy text (strip styling, script tags and all HTML)
  let cleanText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleanText = cleanText.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
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

// Express Endpoints
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", hasApiKey: !!process.env.GEMINI_API_KEY });
});

app.post("/api/content-checker/analyze", async (req, res) => {
  try {
    const { url, image } = req.body;

    if (!url || !image) {
      return res.status(400).json({ error: "Missing both url and screenshot image." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({ 
        error: "GEMINI_API_KEY environment variable is missing. Please configure it in your Settings > Secrets panel." 
      });
    }

    // Lazy initialization
    if (!ai) {
      const currentApiKey = process.env.GEMINI_API_KEY;
      if (currentApiKey.startsWith("ya29.")) {
        ai = new GoogleGenAI({
          httpOptions: {
            headers: {
              'Authorization': `Bearer ${currentApiKey}`,
              'User-Agent': 'aistudio-build',
            }
          }
        });
      } else {
        ai = new GoogleGenAI({
          apiKey: currentApiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });
      }
    }

    // Fetch the target webpage
    let htmlContent = "";
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ContentChecker/1.0",
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        return res.status(400).json({ error: `Failed to fetch target URL. Website returned status: ${response.status} ${response.statusText}` });
      }

      htmlContent = await response.text();
    } catch (fetchErr: any) {
      console.error("Error fetching URL:", fetchErr);
      return res.status(400).json({ 
        error: `Could not connect to target URL. Error details: ${fetchErr.message || fetchErr}. Make sure the URL is correct, public, and allows server visits.` 
      });
    }

    // Parse fetched HTML content
    const parsedWebData = parseHtml(htmlContent);

    // Prepare content parts for Gemini
    const base64Data = image.split(',')[1] || image;
    
    // Determine mime type from raw image header if available
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

    const textPrompt = `You are an elite QA and SEO Auditor. You are tasked with comparing a Reference Document Screenshot against a Crawled Target Webpage to verify content compliance, heading matches, and metadata alignment.

Here is the information extracted from the Crawled Target Webpage:
- Target URL: ${url}
- Page <title>: "${parsedWebData.title || '[None found]'}"
- Meta description: "${parsedWebData.description || '[None found]'}"
- HTML Heading Hierarchy:
${parsedWebData.headings.map(h => `  * <${h.level}>: "${h.text}"`).join("\n") || '  [No headings found]'}
- Extracted Clean Webpage Copy Text:
"${parsedWebData.bodyText}"

Now, inspect the provided Reference Document Screenshot. The screenshot defines the copy, styling notes, headings, and SEO guidelines required for the target webpage.

Compare the Reference Document Screenshot with the Crawled Target Webpage information. Check for:
1. SEO & Metas Match: Does the title/description match what the document specifies or expects?
2. Heading Match: Verify the <h1/h2/h3> hierarchy, spelling, order, and accuracy.
3. Content & Copy Match: Does the visible main body copy match exactly, or are there discrepancies, omissions, typo mismatches, or layout text differences?

Calculate an Overall Compliance Score from 0 to 100 based on accuracy. Provide a comprehensive, detailed report.

Return your response strictly as a JSON object adhering to this schema:
${JSON.stringify(responseSchema, null, 2)}
`;

    const textPart = {
      text: textPrompt
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    });

    const reportText = response.text;
    if (!reportText) {
      return res.status(500).json({ error: "Gemini did not return any analysis results." });
    }

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
    // Prepend protocol if missing
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    let imageUrl = "";

    // If it's a direct image link, use it directly
    if (/\.(png|jpe?g|webp|gif)(?:\?.*)?$/i.test(url)) {
      imageUrl = url;
    } else {
      // Crawl the web page to find high-fidelity screenshot assets
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(10000), // 10s timeout
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
        // Look inside the raw page HTML for common image tags
        const imgRegex = /<img[^>]+src=["'](https:\/\/[^"']+\.(?:png|jpe?g|webp)[^"']*)["']/gi;
        let match;
        while ((match = imgRegex.exec(html)) !== null) {
          const src = match[1];
          if (src.includes("awesomescreenshot") || src.includes("screenshot") || src.includes("cdn") || src.includes("storage") || src.includes("amazonaws")) {
            imageUrl = src;
            break;
          }
        }

        // Ultimate fallback: first absolute image URL
        if (!imageUrl) {
          const fallbackMatch = html.match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/i);
          if (fallbackMatch) {
            imageUrl = fallbackMatch[1];
          }
        }
      }
    }

    if (!imageUrl) {
      return res.status(400).json({ error: "Could not locate a high-fidelity image on the shared screenshot link page. Make sure the link is public." });
    }

    // Clean up HTML entities in URL
    imageUrl = imageUrl.replace(/&amp;/g, '&');

    // Fetch and download the resolved screenshot image
    const imgResponse = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!imgResponse.ok) {
      return res.status(400).json({ error: `Failed to download the screenshot image from resolved URL: ${imageUrl}` });
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

// Setup Vite Dev server middleware OR serve production static files
async function setupFrontend() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
