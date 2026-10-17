/** 리뷰가 어느 단계에서 실패했는지 함께 전달하는 오류. */
export class ReviewStageError extends Error {
  readonly stage: string;

  constructor(stage: string, cause: unknown) {
    super(cause instanceof Error ? cause.message : "알 수 없는 오류가 발생했습니다.", { cause });
    this.stage = stage;
  }
}
