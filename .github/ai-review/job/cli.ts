import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { BotComments } from "../common/comment/bot-comments.ts";
import { GitHubApi } from "../common/github/github-api.ts";
import { RetryingHttp } from "../common/github/retrying-http.ts";
import { ReviewEnvironment } from "../common/review-environment.ts";
import { StaleHeadError } from "../common/stale-head-error.ts";
import { OpenAiApi } from "./model/openai-api.ts";
import { PromptFile } from "./model/prompt-file.ts";
import { PullRequestReview } from "./review/pull-request-review.ts";
import { ReviewStatus } from "./status/review-status.ts";

const REQUIRED_ENVIRONMENT = [
  "GITHUB_TOKEN",
  "OPENAI_API_KEY",
  "REVIEW_REPOSITORY",
  "REVIEW_PULL_NUMBER",
  "REVIEW_HEAD_SHA",
] as const;

/** workflow_run 단계의 진입점. 시크릿을 가지고 모델로 리뷰한다. */
class ReviewJobCommand {
  private readonly environment: NodeJS.ProcessEnv;

  constructor(environment: NodeJS.ProcessEnv) {
    this.environment = environment;
  }

  async run() {
    const values = new ReviewEnvironment(this.environment, REQUIRED_ENVIRONMENT).validate();
    const pullNumber = Number(values.REVIEW_PULL_NUMBER);
    const http = new RetryingHttp();
    const github = new GitHubApi(http, values.GITHUB_TOKEN, values.REVIEW_REPOSITORY);
    // 모델 제공자를 바꿀 때 이 줄과 model/ 안의 구현 클래스만 바꾼다.
    const model = new OpenAiApi(http, values.OPENAI_API_KEY);
    const prompts = await new PromptFile(new URL("./ai-review-prompt.yml", import.meta.url)).read();
    const status = new ReviewStatus(github, values.REVIEW_HEAD_SHA, values.REVIEW_RUN_URL || undefined);

    try {
      const outcome = await new PullRequestReview({
        github,
        model,
        status,
        pullNumber,
        expectedHeadSha: values.REVIEW_HEAD_SHA,
        prompts,
      }).run();
      console.log(`AI review for PR #${pullNumber}: ${outcome}`);
    } catch (error) {
      const message = this.errorMessage(error);
      await this.appendFailureSummary(values.GITHUB_STEP_SUMMARY, message);
      // 새 커밋이 올라온 경우는 다음 실행이 이어받으므로 알리지 않는다.
      if (error instanceof StaleHeadError) {
        console.log(`::notice title=AI code review skipped::${message}`);
        return;
      }
      // 리뷰 봇 실패가 머지를 막지 않도록 워크플로는 성공으로 두고 PR에 안내만 남긴다.
      console.warn(`::warning title=AI code review failed::${message}`);
      await status.failed("리뷰 봇 오류");
      try {
        const comments = await github.getIssueComments(pullNumber);
        await new BotComments(github, pullNumber, comments).reportFailure(message);
      } catch (reportError) {
        console.warn(`::warning title=AI code review failure notice failed::${this.errorMessage(reportError)}`);
      }
    }
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
  }

  private async appendFailureSummary(path: string | undefined, message: string) {
    if (!path) return;
    await appendFile(path, `## AI 코드 리뷰 실패\n\n${message}\n`, "utf8");
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entrypoint === import.meta.url) await new ReviewJobCommand(process.env).run();
