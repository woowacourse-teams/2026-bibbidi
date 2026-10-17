import type { Issue, IssueComment, PullRequest } from "../ai-review-types.ts";
import { BOT_MARKER_PREFIX } from "../comment/comment-markers.ts";

const MIN_CONTEXT_CHARACTERS = 100;

export type GateDecision =
  | { proceed: true; warnings: string[] }
  | { proceed: false; reason: "NO_ISSUE" | "INSUFFICIENT_CONTEXT"; message: string };

type GateInput = {
  pullRequest: PullRequest;
  pullRequestComments: IssueComment[];
  issueNumber: number | undefined;
  issue: Issue | undefined;
  issueComments: IssueComment[];
};

/** 코드 리뷰에 들어가기 전에 Issue 연결, 본문 분량, 라벨을 확인한다. */
export class ReviewGate {
  private readonly input: GateInput;

  constructor(input: GateInput) {
    this.input = input;
  }

  decide(): GateDecision {
    const { pullRequest, pullRequestComments, issueNumber, issue, issueComments } = this.input;
    if (!issueNumber || !issue) {
      return {
        proceed: false,
        reason: "NO_ISSUE",
        message: "연결된 Issue를 찾지 못해 리뷰 봇은 리뷰를 하지 않았습니다. PR 제목이나 본문에 `[#번호]` 또는 `Closes #번호`로 Issue를 연결해 주세요.",
      };
    }

    const issueLength = this.contextLength(issue.body, issueComments);
    const pullRequestLength = this.contextLength(pullRequest.body, pullRequestComments);
    if (issueLength < MIN_CONTEXT_CHARACTERS || pullRequestLength < MIN_CONTEXT_CHARACTERS) {
      return {
        proceed: false,
        reason: "INSUFFICIENT_CONTEXT",
        message: [
          "참고할 만한 팀 내부 맥락이 부족하여 리뷰 봇은 리뷰를 하지 않았습니다.",
          "",
          `- Issue #${issue.number}: 본문과 댓글 ${issueLength}자 (공백 제외, 기준 ${MIN_CONTEXT_CHARACTERS}자)`,
          `- PR: 본문과 댓글 ${pullRequestLength}자 (공백 제외, 기준 ${MIN_CONTEXT_CHARACTERS}자)`,
        ].join("\n"),
      };
    }

    const warnings: string[] = [];
    if (!(pullRequest.labels ?? []).some((label) => label.name.startsWith("type:"))) {
      warnings.push("PR에 `type:` 라벨이 없습니다. 라벨을 지정해 주세요.");
    }
    return { proceed: true, warnings };
  }

  private contextLength(body: string | null | undefined, comments: IssueComment[]) {
    const commentBodies = comments
      .map((comment) => comment.body ?? "")
      .filter((value) => !value.includes(BOT_MARKER_PREFIX));
    return this.meaningfulLength([body ?? "", ...commentBodies].join("\n"));
  }

  /** 템플릿 제목, HTML 주석, 비어 있는 목록 줄을 뺀 공백 제외 글자 수. 빈 템플릿이 제목만으로 기준을 넘지 못하게 한다. */
  private meaningfulLength(text: string) {
    return text
      .replace(/<!--[\s\S]*?-->/g, "")
      .split("\n")
      .filter((line) => !/^\s*#{1,6}\s/.test(line))
      .filter((line) => !/^\s*[-*]\s*(\[[ xX]]\s*)?$/.test(line))
      .join("")
      .replace(/\s+/g, "").length;
  }
}
