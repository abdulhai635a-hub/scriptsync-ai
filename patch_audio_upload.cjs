const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = `
  // Handle uploaded audio files: automatically aligns and cuts speech for each script line if it's a master track
  const handleAudioFiles = async (fileList: FileList) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsSyncingVoice(true);
    setSyncStatus('Analyzing voice narration and detecting script line boundaries...');

    try {
      const additions: Record<number, AudioItem> = {};
      const issues: Array<{ name: string; reason: string }> = [];

      const parsed = files.map((f) => ({ file: f, serial: smartParseAudioSerial(f.name) }));
      const withSerial = parsed.filter((p) => p.serial !== null) as Array<{ file: File; serial: number }>;
      const withoutSerial = parsed.filter((p) => p.serial === null).map((p) => p.file);

      // Case A: Master Audio file uploaded (1 file without a serial number, for multiple script lines)
      if (files.length === 1 && parsed[0].serial === null && lines.length > 1) {
        const file = files[0];
        const audioBuffer = await decodeAudioFromFile(file);
        const totalDuration = audioBuffer.duration;

        setSyncStatus(\`Auto-aligning voice with \${lines.length} script lines...\`);
        const timestamps = await alignAudioWithScript(file, lines, totalDuration);

        let sumDuration = 0;
        let missingLines: number[] = [];

        // Slice audio buffer into individual clips for each script line
        for (const line of lines) {
          const t = timestamps.find((ts) => ts.num === line.num);
          if (!t) {
            missingLines.push(line.num);
            continue;
          }

          const sliceStart = Math.max(0, t.startTime);
          const sliceEnd = Math.min(totalDuration, Math.max(sliceStart + 0.3, t.endTime));
          const effectiveDuration = Number((sliceEnd - sliceStart).toFixed(2));
          sumDuration += effectiveDuration;

          const slicedBuffer = sliceAudioBuffer(audioBuffer, sliceStart, sliceEnd);
          const { blob, url } = convertAudioBufferToBlob(slicedBuffer);
          const slicedFile = new File([blob], \`00\${line.num}_voice.wav\`, { type: 'audio/wav' });

          additions[line.num] = {
            file: slicedFile,
            name: slicedFile.name,
            url,
            duration: effectiveDuration,
            startTime: sliceStart,
            endTime: sliceEnd
          };
        }

        setAudioMap((prev) => ({ ...prev, ...additions }));
        if (missingLines.length > 0) {
          setAudioIssues([{ name: file.name, reason: \`Could not align lines: \${missingLines.join(', ')}\` }]);
          setSyncStatus(\`Aligned \${Object.keys(additions).length} lines (missed \${missingLines.length})\`);
        } else {
          setAudioIssues([]);
          setSyncStatus(\`Perfectly aligned all \${lines.length} script lines!\`);
        }
        setTimeout(() => setSyncStatus(''), 4000);
        return;
      }

      // Case B: Individual audio files uploaded (numbered or unnumbered)
      // 1. Files with explicit serial number (001, 002, 003...)
      for (const item of withSerial) {
        try {
          const buf = await decodeAudioFromFile(item.file);
          const { url, duration } = convertAudioBufferToBlob(buf);
          additions[item.serial] = {
            file: item.file,
            name: item.file.name,
            url,
            duration: Number(duration.toFixed(2)),
            startTime: 0,
            endTime: Number(duration.toFixed(2))
          };
        } catch {
          const { duration, url } = await getAudioDuration(item.file);
          additions[item.serial] = { file: item.file, name: item.file.name, url, duration };
        }
      }

      // 2. Files without explicit serial: assign in sequential order to unfilled script lines
      if (withoutSerial.length > 0) {
        const occupied = new Set([...Object.keys(audioMap).map(Number), ...Object.keys(additions).map(Number)]);
        const targetLines = lines.filter((l) => !occupied.has(l.num));

        for (let i = 0; i < withoutSerial.length; i++) {
          const file = withoutSerial[i];
          const lineNum = targetLines[i] ? targetLines[i].num : (lines.length > 0 ? lines[lines.length-1].num + i + 1 : i + 1);
          try {
            const buf = await decodeAudioFromFile(file);
            const { url, duration } = convertAudioBufferToBlob(buf);
            additions[lineNum] = {
              file,
              name: file.name,
              url,
              duration: Number(duration.toFixed(2)),
              startTime: 0,
              endTime: Number(duration.toFixed(2))
            };
          } catch {
            const { duration, url } = await getAudioDuration(file);
            additions[lineNum] = { file, name: file.name, url, duration };
          }
        }
      }

      setAudioMap((prev) => ({ ...prev, ...additions }));
      setAudioIssues(issues);
      setSyncStatus(\`Auto-synced \${Object.keys(additions).length} voice clips!\`);
      setTimeout(() => setSyncStatus(''), 3000);
    } catch (err: any) {
      console.error('Audio auto-sync error:', err);
      setSyncStatus('');
    } finally {
      setIsSyncingVoice(false);
    }
  };
`;

code = code.replace(/\/\/ Handle uploaded audio files: automatically aligns and cuts speech for each script line\n\s*const handleAudioFiles = async \(fileList: FileList\) => \{[\s\S]*?setIsSyncingVoice\(false\);\n\s*\}\n\s*\};/, replacement.trim());

fs.writeFileSync('src/App.tsx', code);
console.log('Patched handleAudioFiles');
