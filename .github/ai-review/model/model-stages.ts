import type { Finding, ReviewPrompts, ReviewValues } from "../review/ai-review-types.ts";
import type { ReviewModel } from "./review-model.ts";

type ReviewStage = {
  effort: "none" | "low" | "medium";
  focus: string;
};

const CANDIDATE_STAGE: ReviewStage = {
  effort: "medium",
  focus: [
    "1. 언어 관점에서 null-safety, Optional 오용, 불변성, equals/hashCode, 예외 삼킴을 검토한다.",
    "2. 프레임워크·인프라 관점에서 트랜잭션, 영속성, 모듈 경계, 이벤트, HTTP 계약, 빌드와 배포를 검토한다.",
    "3. 도메인·보안 관점에서 상태 규칙, 동시성, 인증·인가, 민감정보, 데이터 무결성과 장애 복구를 검토한다.",
    "각 관점의 후보를 한 번의 구조화된 결과로 반환한다.",
  ].join("\n"),
};

const FINAL_STAGE: ReviewStage = {
  effort: "medium",
  focus: "후보를 원본 diff와 제공된 요구사항·주변 코드로 다시 검증하고, 재현 조건과 영향이 구체적인 항목만 남긴다.",
};

/** 청크마다 후보 탐색 1회, 원본 근거 최종 검증 1회를 수행한다. */
export class ModelStages {
  private readonly model: ReviewModel;
  private readonly prompts: ReviewPrompts;

  constructor(model: ReviewModel, prompts: ReviewPrompts) {
    this.model = model;
    this.prompts = prompts;
  }

  async review(values: ReviewValues, cacheKey: string) {
    const candidates = await this.candidates(values, cacheKey);
    return this.verify(values, candidates.findings, cacheKey);
  }

  private candidates(values: ReviewValues, cacheKey: string) {
    return this.model.review({
      instructions: this.prompts.commonInstructions,
      input: this.fill(this.prompts.stageInputTemplate, { ...values, stageFocus: CANDIDATE_STAGE.focus }),
      reasoningEffort: CANDIDATE_STAGE.effort,
      cacheKey,
    });
  }

  private verify(values: ReviewValues, candidates: Finding[], cacheKey: string) {
    return this.model.review({
      instructions: this.prompts.commonInstructions,
      input: this.fill(this.prompts.finalInputTemplate, {
        ...values,
        candidates: JSON.stringify(candidates),
        stageFocus: FINAL_STAGE.focus,
      }),
      reasoningEffort: FINAL_STAGE.effort,
      cacheKey,
    });
  }

  private fill(template: string, values: Record<string, string>) {
    return template.replace(/{{(\w+)}}/g, (_, key: string) => values[key] ?? "");
  }
}
