import type { Finding } from "../../common/ai-review-types.ts";
import type { CommentableLines } from "./commentable-lines.ts";

const severityOrder = { REQUIRED: 0, CAUTION: 1, ADVICE: 2 } as const;
const confidenceOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

/** 모델이 낸 지적 중 근거를 갖춘 것만 골라 인라인용과 요약용으로 나눈다. */
export class FindingSelection {
  private readonly findings: Finding[];

  constructor(findings: Finding[]) {
    this.findings = findings;
  }

  /** 변경 줄에 붙일 수 있는 지적. 같은 위치와 분류는 하나로 합친다. */
  inline(commentable: CommentableLines, limit = Infinity) {
    const seen = new Set<string>();

    return this.wellFormed()
      .filter((finding) => {
        if (!commentable.has(finding.path, finding.side, finding.line)) return false;
        const key = [finding.path, `${finding.side}:${finding.line}`, finding.kind, finding.category].join(":");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((left, right) => this.rank(left, right))
      .slice(0, limit);
  }

  /** 근거는 갖췄지만 변경 줄에 붙일 수 없어 요약으로 전달할 지적. */
  detached(commentable: CommentableLines, limit: number) {
    const seen = new Set<string>();

    return this.wellFormed()
      .filter((finding) => !commentable.has(finding.path, finding.side, finding.line))
      .filter((finding) => {
        const key = [finding.path, finding.category, finding.title].join(":");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((left, right) => this.rank(left, right))
      .slice(0, limit);
  }

  private wellFormed() {
    return this.findings.filter((finding) => (
      finding.confidence !== "LOW"
      && (finding.kind === "QUESTION") === (finding.category === "#질문-토론")
      && Boolean(finding.trigger.trim() && finding.impact.trim() && finding.evidence.trim())
    ));
  }

  private rank(left: Finding, right: Finding) {
    return severityOrder[left.severity] - severityOrder[right.severity]
      || confidenceOrder[left.confidence] - confidenceOrder[right.confidence];
  }
}
