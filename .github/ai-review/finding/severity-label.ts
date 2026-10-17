import type { Finding } from "../review/ai-review-types.ts";

export class SeverityLabel {
  private readonly finding: Finding;

  constructor(finding: Finding) {
    this.finding = finding;
  }

  text() {
    if (this.finding.kind === "QUESTION") return "검토";
    if (this.finding.severity === "REQUIRED") return "필수";
    return this.finding.severity === "CAUTION" ? "검토" : "참고";
  }
}
