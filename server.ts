import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Lazy initialization / resilient Gemini setup
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not set in environment.");
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support up to 30mb payload for high-resolution base64 receipts
  app.use(express.json({ limit: "30mb" }));
  app.use(express.urlencoded({ extended: true, limit: "30mb" }));

  // Health check API
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // AI-powered receipt scanning endpoint using Gemini
  app.post("/api/gemini/scan-receipt", async (req, res) => {
    try {
      const { imageBase64, mimeType = "image/jpeg" } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: "Missing imageBase64 data in request body." });
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error: "Gemini API key is not configured. Please check your environment variables.",
        });
      }

      // Strip data URL prefix if present
      let cleanBase64 = imageBase64;
      if (cleanBase64.includes(",")) {
        cleanBase64 = cleanBase64.split(",")[1];
      }

      const prompt = `You are an expert Canadian corporate tax accountant and receipt parser.
Analyze this Canadian business receipt or invoice photo.
Extract the key Canadian tax and bookkeeping data:
1. "vendor": The merchant/store/supplier name (e.g. "Tim Hortons", "Staples", "Costco", "Bell Canada", "Petro-Canada", "Uber", "Home Depot"). Clean and proper case.
2. "date": Transaction date in strictly YYYY-MM-DD format. If year is missing or unclear, assume current year (2026).
3. "totalAmountCad": The final total amount paid in Canadian Dollars (CAD) as a numeric float (e.g. 42.50).
4. "gstHstAmount": The GST/HST tax amount explicitly shown on the receipt as a numeric float. If zero or exempt, return 0.
5. "pstQstAmount": The provincial sales tax (PST, QST, or RST) explicitly shown, as a numeric float, or 0.
6. "netAmount": Subtotal before taxes as a numeric float (if missing, calculate: total - gstHst - pstQst).
7. "craCategory": The most accurate CRA GIFI expense category code from this list:
   - "8523": Meals and entertainment (restaurants, cafes, food, client lunches)
   - "8810": Office expenses & supplies (stationery, electronics, printer ink, furniture)
   - "9281": Motor vehicle / vehicle expenses (gas, fuel, parking, tolls, car maintenance)
   - "8811": Software, IT & Cloud Subscriptions (hosting, SaaS, computer software)
   - "9220": Telephone and utilities (internet, mobile phone, electricity)
   - "8521": Advertising and promotion (marketing, ads, domain names)
   - "9200": Travel expenses (flights, train, hotels, taxi/rideshare)
   - "8862": Professional fees (legal, accounting, consulting)
   - "8960": Repairs and maintenance
   - "8690": Insurance
   - "8710": Interest and bank charges
   - "8910": Rent
   - "9270": Other expenses
8. "invoiceNumber": Invoice, receipt, or transaction reference number if visible, or null.
9. "province": Canadian province abbreviation if detectable (e.g. "ON", "BC", "AB", "QC", "NS", etc.) or null.
10. "confidence": "high", "medium", or "low".
11. "rawSummary": A brief 1-sentence description of the purchased items/services for CRA audit records.

Return ONLY valid JSON matching this schema:
{
  "vendor": string,
  "date": string,
  "totalAmountCad": number,
  "gstHstAmount": number,
  "pstQstAmount": number,
  "netAmount": number,
  "craCategory": string,
  "invoiceNumber": string | null,
  "province": string | null,
  "confidence": "high" | "medium" | "low",
  "rawSummary": string
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text || "";
      let parsedData;
      try {
        parsedData = JSON.parse(responseText);
      } catch (parseErr) {
        // Fallback cleanup if model returned markdown code block
        const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
        parsedData = JSON.parse(cleaned);
      }

      return res.json({
        success: true,
        data: parsedData,
      });
    } catch (error: any) {
      console.error("Gemini receipt scan error:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to analyze receipt image with Gemini.",
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
