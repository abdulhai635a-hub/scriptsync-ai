import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Body size limit for base64 images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Lazy initialize Gemini AI client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return aiClient;
}

// Resilient generate content with smart model fallback for high demand/503 spikes
async function generateContentWithRetry(ai: GoogleGenAI, options: any, maxRetries = 3, baseDelayMs = 300) {
  let attempt = 0;
  // Models to cycle through in case of temporary capacity limits
  const fallbackModels = ["gemini-3.7-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
  const currentOptions = { ...options };

  while (attempt < maxRetries) {
    try {
      return await ai.models.generateContent(currentOptions);
    } catch (err: any) {
      attempt++;
      const errStr = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
      
      // If quota exceeded or 429, don't keep hammering, immediately trigger graceful fallback
      if (errStr.includes("429") || errStr.toLowerCase().includes("quota") || errStr.includes("RESOURCE_EXHAUSTED")) {
        console.log("Gemini quota limit reached. Triggering immediate graceful fallback.");
        throw new Error("QUOTA_EXCEEDED");
      }
      
      // If 503 high demand or temporary outage, switch immediately to a lighter alternative model
      if (errStr.includes("503") || errStr.includes("UNAVAILABLE") || errStr.toLowerCase().includes("high demand") || errStr.toLowerCase().includes("overloaded")) {
        const nextModel = fallbackModels[attempt % fallbackModels.length];
        currentOptions.model = nextModel;
        console.log(`High demand on model. Switched to alternative: ${nextModel}`);
      }

      if (attempt >= maxRetries) {
        console.log("Gemini model unavailable after retries, applying graceful fallback logic.");
        throw err;
      }

      // Fast retry delay with jitter
      const delay = baseDelayMs * attempt + Math.floor(Math.random() * 200);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw new Error("Failed after max retries");
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// AI Image Matching Endpoint using Gemini 2.5 Flash
app.post("/api/match-image", async (req, res) => {
  try {
    const { text, imageA, imageB } = req.body;

    if (!text || !imageA?.data || !imageB?.data) {
      return res.status(400).json({
        error: "Missing text or image candidates",
        selected: "A",
        confidence: 0.5,
        reason: "Missing inputs",
        method: "fallback"
      });
    }

    const ai = getGeminiClient();
    if (!ai) {
      // Graceful fallback if no GEMINI_API_KEY
      return res.json({
        selected: "A",
        confidence: 0.5,
        reason: "Gemini API key not configured — selected candidate A as default",
        method: "fallback"
      });
    }

    const prompt = `You are an expert video director selecting which of two candidate images best visually represents this narration line:
"${text}"

Evaluate subject matter, setting, mood, aesthetic quality, and storytelling relevance.
Respond in strict JSON with no markdown formatting:
{
  "selected": "A" or "B",
  "confidence": number between 0.0 and 1.0,
  "reason": "concise explanation under 15 words"
}`;

    const cleanBase64A = imageA.data.replace(/^data:image\/[a-z]+;base64,/, "");
    const cleanBase64B = imageB.data.replace(/^data:image\/[a-z]+;base64,/, "");

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.7-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: imageA.mediaType || "image/jpeg",
                data: cleanBase64A
              }
            },
            {
              inlineData: {
                mimeType: imageB.mediaType || "image/jpeg",
                data: cleanBase64B
              }
            },
            { text: "Image 1 is Candidate A. Image 2 is Candidate B. Which one is better for the narration line?" }
          ]
        }
      ],
      config: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    });

    const responseText = response.text || "{}";
    try {
      const parsed = JSON.parse(responseText.replace(/```json|```/g, "").trim());
      const selected = parsed.selected?.toUpperCase() === "B" ? "B" : "A";
      const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.85;
      const reason = parsed.reason || "Matched visual context to narration";

      return res.json({
        selected,
        confidence,
        reason,
        method: "ai"
      });
    } catch {
      return res.json({
        selected: "A",
        confidence: 0.6,
        reason: "Defaulted to image A after parsing response",
        method: "fallback"
      });
    }
  } catch (error: any) {
    console.log("Match error:", error?.message || error);
    return res.status(200).json({
      selected: "A",
      confidence: 0.5,
      reason: "Analysis timed out — selected primary candidate",
      method: "fallback"
    });
  }
});

// AI Voice & Script Timestamp Auto-Alignment Endpoint using a real-time WhisperX forced-alignment server
// Falls back to deterministic proportional distribution if WHISPERX_SERVER_URL is unset or the call fails
// Compliant with PRD: Support any script length (3, 10, 25, 60+ lines) with 100% full duration coverage
app.post("/api/align-audio", async (req, res) => {
  try {
    let { audioData, mimeType, scriptLines, scriptText, totalDuration } = req.body;
    
    // Normalize script lines from either array or raw script text
    if (!scriptLines || !Array.isArray(scriptLines) || scriptLines.length === 0) {
      if (typeof scriptText === "string" && scriptText.trim().length > 0) {
        scriptLines = scriptText
          .split("\n")
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0)
          .map((text: string, idx: number) => ({
            num: idx + 1,
            text: text.replace(/^\d+[\.\)\:\-\s]+/, "")
          }));
      }
    }

    // If still empty, create dynamic default lines
    if (!scriptLines || !Array.isArray(scriptLines) || scriptLines.length === 0) {
      scriptLines = [
        { num: 1, text: "Scene opening narration." },
        { num: 2, text: "Continuing story development." },
        { num: 3, text: "Closing scene conclusion." }
      ];
    }

    const totalLinesCount = scriptLines.length;
    const dur = typeof totalDuration === "number" && totalDuration > 0 ? totalDuration : Math.max(4, totalLinesCount * 3.5);
    const warnings: string[] = [];

    // Check duration density mismatch (FR-5)
    const avgSecPerLine = dur / totalLinesCount;
    if (avgSecPerLine < 0.8) {
      warnings.push(`Audio duration (${dur.toFixed(1)}s) is short for ${totalLinesCount} lines (~${avgSecPerLine.toFixed(1)}s/line). Segments scaled to fit.`);
    } else if (avgSecPerLine > 18) {
      warnings.push(`Audio duration (${dur.toFixed(1)}s) is long for ${totalLinesCount} lines (~${avgSecPerLine.toFixed(1)}s/line).`);
    }

    // Helper: Deterministic, contiguous proportional distribution algorithm (FR-1, FR-2, FR-3, FR-4)
    // Used only as a fallback if the WhisperX server is unreachable, misconfigured, or times out.
    const computeProportionalTimestamps = (lines: Array<{ num: number; text: string }>, audioDur: number) => {
      const weights = lines.map(l => {
        const words = (l.text || "").trim().split(/\s+/).filter(Boolean).length;
        const chars = (l.text || "").length;
        return Math.max(1, words * 4 + chars);
      });
      const totalWeight = weights.reduce((acc, w) => acc + w, 0) || 1;

      let currentOffset = 0;
      return lines.map((l, idx) => {
        const isLast = idx === lines.length - 1;
        const proportion = weights[idx] / totalWeight;
        const segmentDur = isLast 
          ? Math.max(0.3, audioDur - currentOffset)
          : Math.max(0.3, Number((audioDur * proportion).toFixed(2)));
        
        const start = currentOffset;
        const end = isLast ? audioDur : Number(Math.min(audioDur, start + segmentDur).toFixed(2));
        currentOffset = end;

        return {
          num: l.num || (idx + 1),
          text: l.text || `Line ${idx + 1}`,
          startTime: Number(start.toFixed(2)),
          endTime: Number(end.toFixed(2)),
          duration: Number((end - start).toFixed(2))
        };
      });
    };

    const whisperXUrl = process.env.WHISPERX_SERVER_URL;

    console.log("[align-audio] request received:", {
      hasAudioData: !!audioData,
      audioDataLen: audioData ? String(audioData).length : 0,
      mimeType,
      linesCount: scriptLines.length,
      totalDuration,
      whisperXUrlConfigured: !!whisperXUrl
    });

    // No audio, or the WhisperX server isn't configured: go straight to the deterministic fallback.
    if (!audioData || !whisperXUrl) {
      console.log("[align-audio] skipping WhisperX (no audioData or no URL), using proportional fallback");
      const timestamps = computeProportionalTimestamps(scriptLines, dur);
      return res.json({ 
        timestamps, 
        method: "proportional-acoustic", 
        totalLines: totalLinesCount, 
        audioDuration: dur,
        warnings 
      });
    }

    // Real-time forced alignment via your own WhisperX server (replaces Gemini-based guessing).
    try {
      // --- Wake-up preflight: free-tier hosts return an immediate 502 while spinning up
      // from sleep (they don't queue the request). Ping /health first and wait for it to
      // respond OK before sending the (large, slow) real alignment request. ---
      const healthUrl = whisperXUrl.replace(/\/align\/?$/, "/health");
      console.log("[align-audio] waking WhisperX server via", healthUrl);
      let awake = false;
      for (let attempt = 0; attempt < 8 && !awake; attempt++) {
        try {
          const wakeController = new AbortController();
          const wakeTimeout = setTimeout(() => wakeController.abort(), 10000);
          const wakeResp = await fetch(healthUrl, { signal: wakeController.signal }).finally(() => clearTimeout(wakeTimeout));
          if (wakeResp.ok) {
            awake = true;
            console.log("[align-audio] WhisperX server is awake (attempt", attempt + 1, ")");
          }
        } catch (wakeErr: any) {
          console.log("[align-audio] wake attempt", attempt + 1, "failed:", wakeErr?.message || wakeErr);
        }
        if (!awake) await new Promise((r) => setTimeout(r, 10000));
      }

      console.log("[align-audio] calling WhisperX server at", whisperXUrl, "(audio ~", Math.round(dur), "s,", totalLinesCount, "lines)");

      // Long audio takes real time to transcribe on a free CPU tier — allow up to 4 minutes,
      // and retry once more if we still hit a 502/503 (host still settling after wake-up).
      let whisperResponse: Response | null = null;
      let lastStatus = 0;
      for (let callAttempt = 0; callAttempt < 2; callAttempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 240000);
        try {
          whisperResponse = await fetch(whisperXUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(process.env.WHISPERX_API_KEY ? { "X-API-KEY": process.env.WHISPERX_API_KEY } : {})
            },
            body: JSON.stringify({
              audioData,
              mimeType,
              scriptLines
            }),
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeoutId);
        }

        lastStatus = whisperResponse.status;
        console.log("[align-audio] WhisperX response status:", lastStatus, "(call attempt", callAttempt + 1, ")");

        if (lastStatus !== 502 && lastStatus !== 503) break; // only retry on "still waking up" style errors
        await new Promise((r) => setTimeout(r, 8000));
      }

      if (whisperResponse && whisperResponse.ok) {
        const whisperResult: any = await whisperResponse.json();
        console.log("[align-audio] WhisperX result method:", whisperResult.method, "timestamps count:", whisperResult.timestamps?.length, "first:", whisperResult.timestamps?.[0]);

        if (Array.isArray(whisperResult.timestamps) && whisperResult.timestamps.length === totalLinesCount) {
          return res.json({
            timestamps: whisperResult.timestamps,
            method: whisperResult.method || "whisperx-real",
            totalLines: totalLinesCount,
            audioDuration: dur,
            warnings
          });
        }

        warnings.push("WhisperX server returned an unexpected number of timestamps; used proportional fallback.");
      } else if (whisperResponse) {
        const bodyText = await whisperResponse.text().catch(() => "");
        console.log("[align-audio] WhisperX error body:", bodyText.slice(0, 500));
        warnings.push(`WhisperX server responded with status ${whisperResponse.status}; used proportional fallback.`);
      }
    } catch (whisperErr: any) {
      console.log("WhisperX alignment failed, falling back to proportional method:", whisperErr?.message || whisperErr);
      const reason = whisperErr?.name === "AbortError" ? "timed out" : "was unreachable";
      warnings.push(`WhisperX server ${reason}; used proportional fallback.`);
    }

    // Deterministic fallback across all N lines (only runs if the WhisperX call above failed)
    const timestamps = computeProportionalTimestamps(scriptLines, dur);
    return res.json({ 
      timestamps, 
      method: "proportional-acoustic", 
      totalLines: totalLinesCount, 
      audioDuration: dur,
      warnings 
    });
  } catch (err: any) {
    console.log("Align audio handled via robust fallback:", err?.message || err);
    let { scriptLines, scriptText, totalDuration } = req.body;
    if (!scriptLines && typeof scriptText === "string") {
      scriptLines = scriptText
        .split("\n")
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0)
        .map((t: string, idx: number) => ({
          num: idx + 1,
          text: t.replace(/^\d+[\.\)\:\-\s]+/, "")
        }));
    }
    const lines = Array.isArray(scriptLines) && scriptLines.length > 0 
      ? scriptLines 
      : [{ num: 1, text: "Scene 1" }, { num: 2, text: "Scene 2" }, { num: 3, text: "Scene 3" }];
    const dur = typeof totalDuration === "number" && totalDuration > 0 ? totalDuration : lines.length * 3.5;
    
    // Compute proportional distribution for 100% of lines
    const weights = lines.map((l: any) => Math.max(1, (l.text || "").trim().split(/\s+/).length * 4 + (l.text || "").length));
    const totalW = weights.reduce((a: number, b: number) => a + b, 0) || 1;
    let offset = 0;

    const fallbackTimestamps = lines.map((l: any, i: number) => {
      const isLast = i === lines.length - 1;
      const proportion = weights[i] / totalW;
      const segDur = isLast ? Math.max(0.3, dur - offset) : Math.max(0.3, Number((dur * proportion).toFixed(2)));
      const start = offset;
      const end = isLast ? dur : Number(Math.min(dur, start + segDur).toFixed(2));
      offset = end;
      return {
        num: l.num || (i + 1),
        text: l.text || `Scene ${i + 1}`,
        startTime: Number(start.toFixed(2)),
        endTime: Number(end.toFixed(2)),
        duration: Number((end - start).toFixed(2))
      };
    });

    return res.status(200).json({ 
      timestamps: fallbackTimestamps, 
      method: "fallback", 
      totalLines: lines.length, 
      audioDuration: dur,
      warnings: ["Processed via acoustic word-weight distribution."] 
    });
  }
});

// AI Script Generator Endpoint - Supports customizable line count (e.g. 3, 5, 10, 15, 20+ lines)
app.post("/api/generate-script", async (req, res) => {
  const { topic, tone, lineCount = 5 } = req.body;
  const targetCount = Math.max(3, Math.min(30, parseInt(String(lineCount), 10) || 5));

  try {
    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        script: generateFallbackStoryScript(topic, tone, targetCount)
      });
    }

    const prompt = `Write a compelling, numbered ${targetCount}-line video narration script about "${topic || "a mysterious discovery"}".
Tone: ${tone || "cinematic and inspiring"}.
Format: Strict numbered lines from 1 to ${targetCount} like:
1. First line text here
2. Second line text here
3. Third line text here
...continue until line ${targetCount}.
Every line must be a concise, powerful narration sentence for a video scene. Output ONLY the numbered lines without any introductory or concluding comments.`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    });

    const text = response.text?.trim();
    if (text && text.length > 10) {
      return res.json({ script: text });
    }
    return res.json({ script: generateFallbackStoryScript(topic, tone, targetCount) });
  } catch (err: any) {
    console.log("Generate script fallback applied:", err?.message || err);
    return res.status(200).json({
      script: generateFallbackStoryScript(topic, tone, targetCount)
    });
  }
});

function generateFallbackStoryScript(topic?: string, tone?: string, targetCount = 5): string {
  const safeTopic = topic && topic.trim() ? topic.trim() : "The journey of discovery";
  const lines: string[] = [];
  lines.push(`1. Across the uncharted horizons of ${safeTopic}, a quiet spark ignited.`);
  lines.push(`2. Ancient signals whispered through the darkness, calling pioneers forward.`);
  lines.push(`3. Every intricate mechanism aligned with breathtaking precision and purpose.`);
  
  if (targetCount >= 4) {
    lines.push(`4. A brilliant surge of energy cascaded across the planetary sensors.`);
  }
  if (targetCount >= 5) {
    lines.push(`5. What began as a bold vision now stands ready to reshape the future forever.`);
  }
  for (let i = 6; i <= targetCount; i++) {
    lines.push(`${i}. Continuing the exploration into chapter ${i} of our remarkable expedition.`);
  }
  return lines.join("\n");
}

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ScriptSync AI Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
