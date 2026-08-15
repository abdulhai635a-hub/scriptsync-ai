const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
const newPromptCode = `    const prompt = \`You are an expert audio engineer and video subtitle aligner.
Listen to this voiceover narration audio and accurately detect the exact start and end timestamps (in seconds) for each of the following script lines:
\${scriptLines.map((l: any) => \`\${l.num}. \${l.text}\`).join("\\n")}

Total audio duration is approximately \${dur.toFixed(2)} seconds.

CRITICAL INSTRUCTIONS:
1. You MUST output exactly \${scriptLines.length} items.
2. The timestamps must be strictly sequential (startTime of line N+1 must be >= endTime of line N).
3. Do not leave large gaps between lines unless there is silence in the audio.
4. Listen carefully to the exact words spoken and match them to the text perfectly.
5. If there is silence, it's perfectly fine to have a gap between the endTime of line N and startTime of line N+1.
6. Only return the time where the speech is happening for that specific line.\`;`;

code = code.replace(/const prompt = `You are an expert audio engineer[\s\S]*?Match the spoken speech in the audio to each script line\.`;/, newPromptCode.trim());

const newNormalizeCode = `      if (Array.isArray(parsed) && parsed.length > 0) {
        // Enforce sequential constraints and fix overlaps/errors
        let currentStart = 0;
        const normalized = [];
        
        for (let i = 0; i < scriptLines.length; i++) {
          const aiItem = parsed[i] || {};
          let start = Math.max(currentStart, aiItem.startTime || currentStart);
          let end = Math.max(start + 0.1, aiItem.endTime || (start + (aiItem.duration || 2)));
          
          if (end > dur) end = dur;
          if (start > end) start = Math.max(0, end - 0.1);
          
          normalized.push({
            num: scriptLines[i].num || (i + 1),
            text: scriptLines[i].text || aiItem.text || "",
            startTime: Number(start.toFixed(2)),
            endTime: Number(end.toFixed(2)),
            duration: Number((end - start).toFixed(2))
          });
          currentStart = end;
        }
        return res.json({ timestamps: normalized, method: "ai" });
      }`;

code = code.replace(/if \(Array\.isArray\(parsed\) && parsed\.length > 0\) \{[\s\S]*?method: "ai" \}\);\n      \}/, newNormalizeCode.trim());

// upgrade to gemini-1.5-pro
code = code.replace(/model: "gemini-3.7-flash",\n\s*contents: \[\n\s*\{\n\s*role: "user"/, 'model: "gemini-1.5-pro",\n      contents: [\n        {\n          role: "user"');

fs.writeFileSync('server.ts', code);
console.log('Patched audio alignment logic');
