import type { ScanHit, ScanTarget } from "../ai-review-types.ts";

const SECRET_PATTERNS: Array<{ kind: string; pattern: RegExp }> = [
  { kind: "개인키", pattern: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/ },
  { kind: "AWS 액세스 키", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { kind: "GitHub 토큰", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/ },
  { kind: "OpenAI API 키", pattern: /\bsk-(?:proj-|live-)?[A-Za-z0-9_-]{32,}\b/ },
  { kind: "Slack 토큰", pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { kind: "Google API 키", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { kind: "Discord 웹훅", pattern: /discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]{30,}/ },
  {
    kind: "키·비밀번호 대입",
    pattern: /\b(?:api[_-]?key|secret|token|passwd|password)\b["']?\s*[:=]\s*["'][A-Za-z0-9+/_=-]{20,}["']/i,
  },
];

/** 외부 AI로 보내면 안 되는 비밀값처럼 보이는 문자열을 찾는다. 찾은 값 자체는 결과에 담지 않는다. */
export class SecretScan {
  findIn(targets: ScanTarget[]) {
    const hits: ScanHit[] = [];
    for (const target of targets) {
      const matched = SECRET_PATTERNS.find(({ pattern }) => pattern.test(target.text));
      if (matched) hits.push({ location: target.location, kind: matched.kind });
    }
    return hits;
  }
}
