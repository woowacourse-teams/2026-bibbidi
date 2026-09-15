export function extractIssueNumber(prompt) {
  const text = String(prompt ?? '');
  const patterns = [
    /github\.com\/[^\s/]+\/[^\s/]+\/issues\/(\d+)/i,
    /(?:issue|이슈)\s*#?\s*(\d+)/i,
    /(?:^|\s)#(\d+)\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
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

