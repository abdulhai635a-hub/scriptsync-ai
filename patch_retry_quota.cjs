const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const newRetry = `
async function generateContentWithRetry(ai: GoogleGenAI, options: any, maxRetries = 5, baseDelayMs = 2000) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await ai.models.generateContent(options);
    } catch (err: any) {
      attempt++;
      const errStr = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
      
      // If quota exceeded or 429, don't even retry, just throw to trigger fallback immediately
      if (errStr.includes("429") || errStr.toLowerCase().includes("quota") || errStr.includes("RESOURCE_EXHAUSTED")) {
        console.warn("Quota exceeded. Triggering immediate fallback.");
        throw new Error("QUOTA_EXCEEDED");
      }
      
      console.warn(\`[Retry \${attempt}/\${maxRetries}] Gemini API high demand/error:\`, errStr);
      
      if (attempt >= maxRetries) {
        console.error("Gemini API failed permanently after max retries", errStr);
        throw err;
      }
      
      // If 503 high demand, switch to flash fallback
      if (errStr.includes("503") || errStr.includes("UNAVAILABLE") || errStr.includes("high demand")) {
        console.log("High demand detected. Switching to gemini-3.1-flash-lite fallback model for next attempt.");
        options.model = "gemini-3.1-flash-lite";
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.log(\`Waiting \${Math.round(delay)}ms before retry...\`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw new Error("Failed after max retries");
}
`;

code = code.replace(/async function generateContentWithRetry[\s\S]*?throw new Error\("Failed after max retries"\);\n\}/, newRetry.trim());

fs.writeFileSync('server.ts', code);
console.log('Patched retry logic for quota');
