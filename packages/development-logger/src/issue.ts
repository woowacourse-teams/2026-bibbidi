export function extractIssueNumber(prompt: unknown): number | null {
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

/**
 * 템플릿 제목, 주석, 빈 목록 기호, 체크박스만 남은 본문은 내용이 없는 것으로 본다.
 * 체크박스는 체크 여부와 상관없이 제외한다. 유형을 고르는 것은 설계 합의가 아니기 때문이다.
 */
export function hasIssueContent(body: unknown): boolean {
  return String(body ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line
      && !line.startsWith('#')
      && !/^[-*]\s*\[[\sxX]\]/.test(line)
      && !/^[-*]\s*$/.test(line));
}

export function hasInitialAdr(body: unknown): boolean {
  const text = String(body ?? '');
  return /^## ADR\s*$/m.test(text)
    && /^### 결정\s*$/m.test(text)
    && /^### 이유\s*$/m.test(text)
    && /^### 근거\s*$/m.test(text)
    && /^### 검증\s*$/m.test(text);
}
