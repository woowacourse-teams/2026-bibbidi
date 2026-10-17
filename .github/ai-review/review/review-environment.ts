const requiredEnvironment = [
  "GITHUB_TOKEN",
  "OPENAI_API_KEY",
  "REVIEW_REPOSITORY",
  "REVIEW_PULL_NUMBER",
  "REVIEW_HEAD_SHA",
] as const;

export type ReviewEnvironmentValues = Record<(typeof requiredEnvironment)[number], string> & {
  GITHUB_STEP_SUMMARY?: string;
};

export class ReviewEnvironment {
  private readonly environment: NodeJS.ProcessEnv;

  constructor(environment: NodeJS.ProcessEnv) {
    this.environment = environment;
  }

  validate() {
    const missing = requiredEnvironment.filter((name) => !this.environment[name]?.trim());
    if (missing.length > 0) throw new Error(`필수 환경변수가 없습니다: ${missing.join(", ")}`);

    const pullNumber = Number(this.environment.REVIEW_PULL_NUMBER);
    if (!Number.isSafeInteger(pullNumber) || pullNumber < 1) {
      throw new Error("REVIEW_PULL_NUMBER는 1 이상의 정수여야 합니다.");
    }

    return this.environment as ReviewEnvironmentValues;
  }
}
