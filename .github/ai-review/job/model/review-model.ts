import type { ReviewResult } from "../../common/ai-review-types.ts";

export type ModelRequest = {
  instructions: string;
  input: string;
  reasoningEffort: string;
  cacheKey: string;
};

/** 리뷰에 쓰는 AI 모델 하나. 모델 제공자를 바꿀 때 이 계약을 구현하는 클래스만 바꾼다. */
export interface ReviewModel {
  review(request: ModelRequest): Promise<ReviewResult>;
}
