export type ReviewEnvironmentValues = Record<string, string> & {
  GITHUB_STEP_SUMMARY?: string;
};

/** 워크플로가 넘기는 환경변수. 단계마다 필요한 이름이 달라 필수 목록을 받는다. */
export class ReviewEnvironment {
  private readonly environment: NodeJS.ProcessEnv;
  private readonly required: readonly string[];

  constructor(environment: NodeJS.ProcessEnv, required: readonly string[]) {
    this.environment = environment;
    this.required = required;
  }

  validate() {
    const missing = this.required.filter((name) => !this.environment[name]?.trim());
    if (missing.length > 0) throw new Error(`필수 환경변수가 없습니다: ${missing.join(", ")}`);

    const pullNumber = Number(this.environment.REVIEW_PULL_NUMBER);
    if (!Number.isSafeInteger(pullNumber) || pullNumber < 1) {
      throw new Error("REVIEW_PULL_NUMBER는 1 이상의 정수여야 합니다.");
    }

    return this.environment as ReviewEnvironmentValues;
  }
}
