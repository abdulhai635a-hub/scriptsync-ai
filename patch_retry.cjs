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
      console.error(\`Gemini API error (attempt \${attempt}/\${maxRetries}):\`, err.message || JSON.stringify(err));
      
      if (attempt >= maxRetries) {
        throw err;
      }
      
      // If 503 high demand, switch to flash-lite fallback
      if (err.message?.includes("503") || err.status === "UNAVAILABLE" || err.message?.includes("high demand") || (err.error && err.error.code === 503)) {
        console.log("High demand detected. Switching model to gemini-3.1-flash-lite for next attempt.");
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
console.log('Patched server.ts retry logic');
