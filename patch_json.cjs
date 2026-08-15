const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/const responseText = response\.text \|\| "\[\]";\n\s*try \{\n\s*const parsed = JSON\.parse\(responseText\.trim\(\)\);/, 'const responseText = response.text || "[]";\n    try {\n      const parsed = JSON.parse(responseText.replace(/```(?:json)?|```/g, "").trim());');

fs.writeFileSync('server.ts', code);
console.log('Fixed json parsing in audio');
