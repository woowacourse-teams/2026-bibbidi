import type { ScanHit, ScanTarget } from "../ai-review-types.ts";

const INJECTION_PATTERNS: Array<{ kind: string; pattern: RegExp }> = [
  {
    kind: "이전 지시 무시 요구",
    pattern: /\b(?:ignore|disregard|forget)\s+(?:all\s+|any\s+|every\s+)?(?:the\s+|your\s+)?(?:previous|prior|above|earlier|system)\s+(?:instructions?|prompts?|rules?)/i,
  },
  {
    kind: "시스템 프롬프트·비밀 노출 요구",
    pattern: /\b(?:reveal|print|show|leak|output|repeat)\s+(?:me\s+)?(?:your\s+|the\s+)?(?:system\s+prompt|hidden\s+instructions?|api[_\s-]?keys?|secrets?)/i,
  },
  {
    kind: "리뷰 결과 조작 요구",
    pattern: /\b(?:approve|accept|lgtm)\s+(?:this\s+)?(?:pr|pull\s+request|change)s?\s+(?:without|regardless|no\s+matter)/i,
  },
  {
    kind: "프롬프트 구조 닫기 태그",
    pattern: /<\/?(?:untrusted_[a-z_]+|repository_conventions|review_stage|pull_request)>/i,
  },
  {
    kind: "이전 지시 무시 요구",
    pattern: /(?:이전|위|앞선|기존|모든)\s*(?:의\s*)?(?:지시|명령|지침|프롬프트)(?:사항|문)?(?:을|를|은|는)?\s*(?:모두\s*)?(?:무시|잊어|따르지)/,
  },
  {
    kind: "시스템 프롬프트·비밀 노출 요구",
    pattern: /(?:시스템\s*프롬프트|내부\s*지시|api\s*키|비밀\s*값)(?:를|을)?\s*(?:알려|출력|공개|보여|말해)/i,
  },
];

/** AI에게 지시를 내리려는 문구를 찾는다. 리뷰 입력은 신뢰할 수 없는 데이터라서 지시로 쓰이면 안 된다. */
export class InjectionScan {
  findIn(targets: ScanTarget[]) {
    const hits: ScanHit[] = [];
    for (const target of targets) {
      const matched = INJECTION_PATTERNS.find(({ pattern }) => pattern.test(target.text));
      if (matched) hits.push({ location: target.location, kind: matched.kind });
    }
    return hits;
  }
}
