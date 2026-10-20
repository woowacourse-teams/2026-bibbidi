import type { Finding } from "../../common/ai-review-types.ts";
import { SUMMARY_MARKER } from "../../common/comment/comment-markers.ts";
import type { HeadMarker } from "../../common/comment/head-marker.ts";
import { SeverityLabel } from "../finding/severity-label.ts";

export type SummaryInput = {
  findings: Finding[];
  headMarker: HeadMarker;
  inlineLimit: number;
  chunks: number;
  unavailablePatches: number;
  treeTruncated: boolean;
  aiSufficientChanges?: string[];
  humanReviewChanges?: string[];
  designQuestions?: string[];
  detachedFindings?: Finding[];
  warnings?: string[];
  omittedInlineCount?: number;
};

export class SummaryComment {
  private readonly input: SummaryInput;

  constructor(input: SummaryInput) {
    this.input = input;
  }

  body() {
    const {
      findings, headMarker, inlineLimit, chunks, unavailablePatches, treeTruncated,
      aiSufficientChanges = [], humanReviewChanges = [], designQuestions = [],
      detachedFindings = [], warnings = [], omittedInlineCount = 0,
    } = this.input;
    const all = [...findings, ...detachedFindings];
    const decision = this.verdict(all);
    const requests = findings.filter((finding) => finding.kind === "DEFECT" && finding.severity === "REQUIRED");
    const humanReview = findings.filter((finding) => finding.kind === "QUESTION");
    const suggestions = findings.filter((finding) => finding.kind === "DEFECT" && finding.severity !== "REQUIRED");
    const coverage = [
      `diff 청크: ${chunks}`,
      `patch 미제공 파일: ${unavailablePatches}`,
      treeTruncated ? "저장소 트리: GitHub API 제한으로 일부만 조회" : "저장소 트리: 전체 조회",
    ].join(" · ");
    const notes = [
      ...warnings,
      omittedInlineCount > 0 ? `인라인 댓글은 ${inlineLimit}개까지만 남겨서 ${omittedInlineCount}건을 줄였습니다.` : "",
    ].filter(Boolean);

    return `${SUMMARY_MARKER}
${headMarker.text()}
## 🤖 AI Code Review

${notes.length > 0 ? `### 📌 알림\n\n${notes.map((note) => `- ${note}`).join("\n")}\n\n` : ""}${requests.length > 0 ? `### ⚠️ 반영 필요\n\n${this.findingList(requests)}` : `### ✅ 통과 사유\n\n- 재현 가능한 \`[필수]\` 수준의 결함을 확인하지 못했습니다.`}

${suggestions.length > 0 ? `### 💬 개선 의견\n\n${this.findingList(suggestions)}\n` : ""}
${detachedFindings.length > 0 ? `### 📎 변경 줄에 붙일 수 없는 지적\n\n${this.findingList(detachedFindings, false)}\n` : ""}
### 🤖 AI만으로 충분한 것

${this.changeList(aiSufficientChanges, "이번 변경에서 AI와 자동 검증만으로 충분한 항목을 찾지 못했습니다.")}

### 👀 사람이 확인해야 하는 것

${this.changeList(humanReviewChanges, "이번 변경에서 별도의 사람 판단이 필요한 항목을 찾지 못했습니다.")}

${humanReview.length > 0 ? `#### 리뷰 질문\n\n${this.findingList(humanReview)}` : ""}
${designQuestions.length > 0 ? `\n### ❓ 설계 질문\n\n${designQuestions.map((question, index) => `${index + 1}. ${this.brief(question)}`).join("\n")}\n` : ""}
### 🔎 검토 범위

- ${coverage}
- 인라인 코멘트: ${findings.length}/${inlineLimit}

---
**[${decision.tag}] AI 판정: ${decision.text}** — ${this.oneLineSummary(all)}

<!-- bibbidi-ai-review:meta ${JSON.stringify(this.meta(decision.text))} -->`;
  }

  private meta(verdict: string) {
    const { findings } = this.input;
    const count = (severity: Finding["severity"]) => findings.filter((finding) => (
      finding.kind === "DEFECT" && finding.severity === severity
    )).length;
    const questions = findings.filter((finding) => finding.kind === "QUESTION").length;
    const categories = Object.fromEntries(
      [...new Set(findings.map((finding) => finding.category))]
        .sort()
        .map((category) => [category, findings.filter((finding) => finding.category === category).length]),
    );
    return { verdict, 필수: count("REQUIRED"), 검토: count("CAUTION") + questions, 참고: count("ADVICE"), categories };
  }

  private verdict(findings: Finding[]) {
    if (findings.some((finding) => finding.kind === "DEFECT" && finding.severity === "REQUIRED")) {
      return { tag: "필수", text: "반영 필요" } as const;
    }
    if (findings.some((finding) => finding.kind === "QUESTION" || finding.severity === "CAUTION")) {
      return { tag: "검토", text: "조건부 통과" } as const;
    }
    return { tag: "참고", text: "통과" } as const;
  }

  private oneLineSummary(findings: Finding[]) {
    if (findings.length === 0) return "검증 가능한 재현 조건과 diff 근거를 모두 갖춘 결함을 확인하지 못했습니다.";
    const defects = findings.filter((finding) => finding.kind === "DEFECT");
    const questions = findings.filter((finding) => finding.kind === "QUESTION");
    const required = defects.filter((finding) => finding.severity === "REQUIRED").length;
    return `검증된 지적 ${defects.length}개${required ? ` 중 필수 대응 ${required}개` : ""}와 사람의 판단이 필요한 질문 ${questions.length}개를 남겼습니다.`;
  }

  private findingList(values: Finding[], withLine = true) {
    if (values.length === 0) return "- 없음";
    return values.map((finding) => [
      `- **[${new SeverityLabel(finding).text()}] ${finding.category}** (\`${finding.path}${withLine ? `:${finding.line}` : ""}\`): ${finding.title}`,
      `  ${this.brief(finding.explanation)} **영향:** ${this.brief(finding.impact)}`,
    ].join("\n")).join("\n");
  }

  private changeList(values: string[], emptyMessage: string) {
    return values.length > 0
      ? values.map((value) => `- ${this.brief(value)}`).join("\n")
      : `- ${emptyMessage}`;
  }

  private brief(value: string) {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized.length > 220 ? `${normalized.slice(0, 219).trimEnd()}…` : normalized;
  }
}
