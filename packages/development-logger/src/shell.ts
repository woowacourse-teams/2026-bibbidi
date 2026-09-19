import type { ShellSegment } from './types.ts';

function removeHeredocBodies(command: string): string {
  const kept: string[] = [];
  let terminator: string | null = null;
  for (const line of String(command ?? '').split(/\r?\n/)) {
    if (terminator) {
      if (line.trim() === terminator) terminator = null;
      continue;
    }
    kept.push(line);
    const match = line.match(/(?<!<)<<(?!<)-?\s*(['"]?)([A-Za-z_][\w-]*)\1/);
    if (match) terminator = match[2] ?? null;
  }
  return kept.join('\n');
}

export function splitShell(command: string): ShellSegment[] {
  const text = removeHeredocBodies(command);
  const segments: ShellSegment[] = [];
  let current = '';
  let quote: string | null = null;
  const push = (next: string | null) => {
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

export function unquote(value: string): string {
  const text = String(value ?? '');
  return /^(['"]).*\1$/s.test(text) ? text.slice(1, -1) : text;
}

export function tokens(segment: string): string[] {
  return (String(segment ?? '').match(/"(?:\\.|[^"\\])*"|'[^']*'|\S+/g) ?? []).map(unquote);
}

export function argumentValues(command: string, longName: string, shortName: string | null = null): string[] {
  const names = shortName ? `(?:--${longName}|-${shortName})` : `--${longName}`;
  const pattern = new RegExp(`(?:^|\\s)${names}(?:=|\\s+)(?:"([^"]*)"|'([^']*)'|([^\\s]+))`, 'gi');
  return [...String(command).matchAll(pattern)].map((match) => match[1] ?? match[2] ?? match[3] ?? '');
}

export function writesFile(segment: string): boolean {
  const unquoted = String(segment)
    .replace(/"(?:\\.|[^"\\])*"|'[^']*'/g, '""')
    .replace(/\d*>&\d+/g, '')
    .replace(/&?\d*>>?\s*\/dev\/null/g, '');
  return />/.test(unquoted) || /^tee\b/i.test(segment);
}
