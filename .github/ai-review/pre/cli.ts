import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { BotComments } from "../common/comment/bot-comments.ts";
import { NoticeComment } from "../common/comment/notice-comment.ts";
import { ReviewPrecheck } from "../common/gate/review-precheck.ts";
import { GitHubApi } from "../../github/github-api.ts";
import { RetryingHttp } from "../../github/retrying-http.ts";
import { ReviewEnvironment } from "../common/review-environment.ts";
import { StaleHeadError } from "../common/stale-head-error.ts";

const REQUIRED_ENVIRONMENT = [
  "GITHUB_TOKEN",
  "REVIEW_REPOSITORY",
  "REVIEW_PULL_NUMBER",
  "REVIEW_HEAD_SHA",
] as const;

/**
 * pull_request 단계의 진입점. 시크릿 없이 PR이 리뷰 대상인지만 확인한다.
 * 이 단계는 PR 코드로 실행되어 결과를 믿을 수 없으므로, 통과해도 job 단계가 같은 검사를 다시 한다.
 */
class PreCheckCommand {
  private readonly environment: NodeJS.ProcessEnv;

  constructor(environment: NodeJS.ProcessEnv) {
    this.environment = environment;
  }

  async run() {
    const values = new ReviewEnvironment(this.environment, REQUIRED_ENVIRONMENT).validate();
    const pullNumber = Number(values.REVIEW_PULL_NUMBER);
    const github = new GitHubApi(new RetryingHttp(), values.GITHUB_TOKEN, values.REVIEW_REPOSITORY);

    try {
      const precheck = new ReviewPrecheck(github, pullNumber, values.REVIEW_HEAD_SHA);
      const context = await precheck.load();
      const botComments = new BotComments(github, pullNumber, context.pullRequestComments);

      // 이미 리뷰가 끝난 PR은 요약 댓글을 지우지 않도록 아무것도 하지 않는다.
      if (botComments.hasCompletedReview()) {
        console.log(`AI review already completed for PR #${pullNumber}`);
        return;
      }

      const decision = precheck.decide(context);
      if (decision.proceed) {
        console.log(`Precheck passed for PR #${pullNumber}`);
        for (const warning of decision.warnings) console.log(`::warning title=AI review precheck::${warning}`);
        return;
      }
      if (decision.silent) {
        console.log(`Precheck skipped for PR #${pullNumber}: ${decision.reason}`);
        return;
      }

      // 리뷰 대상이 아니면 실패로 표시해 job 단계가 실행되지 않게 한다.
      console.error(`::error title=AI review precheck::${decision.message.split("\n")[0]}`);
      await this.appendSummary(values.GITHUB_STEP_SUMMARY, decision.message);
      await this.notify(botComments, decision.message);
      process.exitCode = 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
      // 사전 검사가 깨져도 PR을 막지 않는다. job 단계가 같은 검사를 다시 한다.
      if (error instanceof StaleHeadError) console.log(`::notice title=AI review precheck skipped::${message}`);
      else console.warn(`::warning title=AI review precheck failed::${message}`);
    }
  }

  private async notify(botComments: BotComments, message: string) {
    try {
      await botComments.upsertSummary(new NoticeComment(message).body());
    } catch (error) {
      // 포크 PR은 쓰기 권한이 없어 댓글을 달 수 없다. 체크 결과와 요약으로 알린다.
      const reason = error instanceof Error ? error.message : "알 수 없는 오류";
      console.warn(`::warning title=AI review precheck comment skipped::${reason}`);
    }
  }

  private async appendSummary(path: string | undefined, message: string) {
    if (!path) return;
    await appendFile(path, `## AI 리뷰 사전 검사\n\n${message}\n`, "utf8");
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entrypoint === import.meta.url) await new PreCheckCommand(process.env).run();
