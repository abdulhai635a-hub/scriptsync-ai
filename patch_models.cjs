const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

// The first one is image matching, revert to gemini-3.7-flash
code = code.replace(/model: "gemini-1\.5-pro",\n      contents: \[\n        \{\n          role: "user",\n          parts: \[\n            \{ text: prompt \},\n            \{\n              inlineData: \{\n                mimeType: imageA\.mediaType/, 'model: "gemini-3.7-flash",\n      contents: [\n        {\n          role: "user",\n          parts: [\n            { text: prompt },\n            {\n              inlineData: {\n                mimeType: imageA.mediaType');

// The second one is audio alignment, upgrade to gemini-1.5-pro
code = code.replace(/model: "gemini-3\.7-flash",\n      contents: \[\n        \{\n          role: "user",\n          parts: \[\n            \{ text: prompt \},\n            \{\n              inlineData: \{\n                mimeType: mimeType \|\| "audio\/mp3",/, 'model: "gemini-1.5-pro",\n      contents: [\n        {\n          role: "user",\n          parts: [\n            { text: prompt },\n            {\n              inlineData: {\n                mimeType: mimeType || "audio/mp3",');

fs.writeFileSync('server.ts', code);
console.log('Fixed models');
