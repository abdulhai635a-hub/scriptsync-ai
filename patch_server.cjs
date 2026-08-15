const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

const retryFunction = `
async function generateContentWithRetry(ai: GoogleGenAI, options: any, maxRetries = 3, baseDelayMs = 2000) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await ai.models.generateContent(options);
    } catch (err: any) {
      attempt++;
      console.error(\`Gemini API error (attempt \${attempt}/\${maxRetries}):\`, err.message || err);
      if (attempt >= maxRetries) {
        throw err;
      }
      const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.log(\`Waiting \${Math.round(delay)}ms before retry...\`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw new Error("Failed after max retries");
}
`;

serverCode = serverCode.replace('// Health check endpoint', retryFunction + '\n// Health check endpoint');

serverCode = serverCode.replace(/await ai\.models\.generateContent\(/g, 'await generateContentWithRetry(ai, ');

fs.writeFileSync('server.ts', serverCode);
console.log('Patched server.ts');
