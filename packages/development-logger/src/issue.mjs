import { splitShell, tokens } from './shell.mjs';

const VALUE_FLAGS = new Set(['--json', '--jq', '-q', '--template', '-t']);

export function extractIssueNumber(prompt) {
  const text = String(prompt ?? '');
  const patterns = [
    /github\.com\/[^\s/]+\/[^\s/]+\/issues\/(\d+)/i,
    /(?:issue|이슈)\s*#?\s*(\d+)/i,
    /#?(\d+)\s*번째?\s*(?:issue|이슈)/i,
    /(?:^|\s)#(\d+)\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

export function issueFromCommand(command, repository) {
  for (const { text } of splitShell(command)) {
    const parts = tokens(text);
    if (parts[0] !== 'gh' || parts[1] !== 'issue' || parts[2] !== 'view') continue;
    let target = null;
    let repo = null;
    for (let index = 3; index < parts.length; index += 1) {
      const part = parts[index];
      if (part === '--repo' || part === '-R') {
        repo = parts[index + 1];
        index += 1;
      } else if (part.startsWith('--repo=')) {
        repo = part.slice('--repo='.length);
      } else if (VALUE_FLAGS.has(part)) {
        index += 1;
      } else if (!part.startsWith('-') && target === null) {
        target = part;
      }
    }
    const url = target?.match(/github\.com\/([^/\s]+\/[^/\s]+)\/issues\/(\d+)/i);
    const number = url ? url[2] : target?.match(/^#?(\d+)$/)?.[1];
    if (url) repo = url[1];
    if (!number) continue;
    if (repo && repository && repo.toLowerCase() !== String(repository).toLowerCase()) continue;
    return Number(number);
  }
  return null;
}

export function hasInitialAdr(body) {
  const text = String(body ?? '');
  return /^## ADR\s*$/m.test(text)
    && /^### 결정\s*$/m.test(text)
    && /^### 이유\s*$/m.test(text)
    && /^### 근거\s*$/m.test(text)
    && /^### 검증\s*$/m.test(text);
}
