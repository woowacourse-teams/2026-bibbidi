import type { Finding } from "../review/ai-review-types.ts";
import { SeverityLabel } from "../finding/severity-label.ts";

export class InlineComment {
  private readonly finding: Finding;

  constructor(finding: Finding) {
    this.finding = finding;
  }

  body() {
    const { finding } = this;
    const label = new SeverityLabel(finding).text();
    const suggestion = finding.suggestion.trim()
      ? `\n\n<details><summary>💡 제안</summary>\n\n${finding.suggestion.trim()}\n\n</details>`
      : "";
    return `**[${label}] ${finding.category}** — ${finding.title.trim()}

${finding.explanation.trim()}

- **발생 조건**: ${finding.trigger.trim()}
- **영향**: ${finding.impact.trim()}
- **근거**: ${finding.evidence.trim()}

${suggestion}\n\n_확신도: ${finding.confidence}_`;
  }
}
