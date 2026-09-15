function removeHeredocBodies(command) {
  const kept = [];
  let terminator = null;
  for (const line of String(command ?? '').split(/\r?\n/)) {
    if (terminator) {
      if (line.trim() === terminator) terminator = null;
      continue;
    }
    kept.push(line);
    const match = line.match(/(?<!<)<<(?!<)-?\s*(['"]?)([A-Za-z_][\w-]*)\1/);
    if (match) terminator = match[2];
  }
  return kept.join('\n');
}

export function splitShell(command) {
  const text = removeHeredocBodies(command);
  const segments = [];
  let current = '';
  let quote = null;
  const push = (next) => {
    const value = current.trim();
    if (value) segments.push({ text: value, next });
    current = '';
  };
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      current += char;
      if (char === quote && text[index - 1] !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    const pair = text.slice(index, index + 2);
    if (pair === '&&' || pair === '||') {
      push(pair);
      index += 1;
    } else if (char === '|') {
      push('|');
    } else if (char === ';' || char === '\n') {
      push(';');
    } else if (char === '&' && text[index - 1] !== '>' && text[index + 1] !== '>') {
      push('&');
    } else {
      current += char;
    }
  }
  push(null);
  return segments;
}

export function unquote(value) {
  const text = String(value ?? '');
  return /^(['"]).*\1$/s.test(text) ? text.slice(1, -1) : text;
}

export function tokens(segment) {
  return (String(segment ?? '').match(/"(?:\\.|[^"\\])*"|'[^']*'|\S+/g) ?? []).map(unquote);
}

export function writesFile(segment) {
  const unquoted = String(segment)
    .replace(/"(?:\\.|[^"\\])*"|'[^']*'/g, '""')
    .replace(/\d*>&\d+/g, '')
    .replace(/&?\d*>>?\s*\/dev\/null/g, '');
  return />/.test(unquoted) || /^tee\b/i.test(segment);
}
