import { sendWebhookWithRetry } from "../discord/discord-client.ts";
import type { GitHubApi } from "../github/github-api.ts";
import type { WorkflowJob } from "../github/github-types.ts";

const FAILURE_COLOR = 0xed4245;
const MAX_NAME_CHARACTERS = 80;
const MAX_LISTED_JOBS = 5;
const MAX_LISTED_STEPS = 3;

const CONCLUSION_LABELS: Record<string, string> = {
  failure: "실패",
  timed_out: "시간 초과",
  startup_failure: "시작 실패",
};

export type AlertResult = "sent" | "no-webhook" | "failed";

/**
 * GitHub Actions 워크플로가 실패하면 전용 Discord 채널에 알린다.
 * 워크플로 이름, 브랜치, 작업 이름은 외부 PR이 정할 수 있는 값이라 코드 표기로 감싸고 링크는 직접 만든 주소만 쓴다.
 * 알림이 실패해도 워크플로 결과는 바꾸지 않는다.
 */
export class WorkflowFailureAlert {
  private readonly environment: NodeJS.ProcessEnv;
  private readonly github: GitHubApi;

  constructor(environment: NodeJS.ProcessEnv, github: GitHubApi) {
    this.environment = environment;
    this.github = github;
  }

  async send(): Promise<AlertResult> {
    const webhook = this.environment.DISCORD_WEBHOOK_GITHUB_ACTION;
    if (!webhook) {
      console.warn("::warning::DISCORD_WEBHOOK_GITHUB_ACTION 시크릿이 설정되지 않아 워크플로 실패 알림을 보내지 않았습니다.");
      return "no-webhook";
    }

    try {
      await sendWebhookWithRetry(webhook, this.payload(await this.failedJobs()));
      return "sent";
    } catch (error) {
      const reason = error instanceof Error ? error.message : "알 수 없는 오류";
      console.warn(`::warning::워크플로 실패 알림 전송에 실패했습니다. ${reason}`);
      return "failed";
    }
  }

  /** 실패한 작업과 단계를 조회한다. 조회에 실패해도 알림은 보낸다. */
  private async failedJobs() {
    const runId = Number(this.environment.RUN_ID);
    if (!Number.isSafeInteger(runId) || runId < 1) return [];

    try {
      const jobs = await this.github.getWorkflowRunJobs(runId);
      return jobs.filter((job) => job.conclusion === "failure" || job.conclusion === "timed_out");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "알 수 없는 오류";
      console.warn(`::warning::실패한 작업 목록을 조회하지 못했습니다. ${reason}`);
      return [];
    }
  }

  private payload(failedJobs: WorkflowJob[]) {
    const env = this.environment;
    const repository = env.GITHUB_REPOSITORY ?? "";
    const workflowName = this.plain(env.WORKFLOW_NAME || "알 수 없음");
    const runUrl = this.trustedUrl(env.RUN_URL, repository);
    const fields = [
      { name: "🧪 결론", value: CONCLUSION_LABELS[env.CONCLUSION ?? ""] ?? this.code(env.CONCLUSION), inline: true },
      { name: "⚡ 이벤트", value: this.code(env.EVENT), inline: true },
      { name: "🌿 브랜치", value: this.code(env.BRANCH), inline: true },
      { name: "🔖 커밋", value: this.commit(repository, env.SHA), inline: true },
      { name: "👤 실행자", value: this.actor(env.ACTOR), inline: true },
    ];

    const pullRequest = this.pullRequest(repository, env.PULL_NUMBER);
    if (pullRequest) fields.push({ name: "🔀 PR", value: pullRequest, inline: true });
    if (failedJobs.length > 0) fields.push({ name: "❌ 실패한 작업", value: this.jobLines(failedJobs), inline: false });
    if (runUrl) fields.push({ name: "🔎 실행 로그", value: `[워크플로 실행 보기 ↗](${runUrl})`, inline: false });

    return {
      username: "Bibbidi GitHub Actions 알리미",
      allowed_mentions: { parse: [], users: [] },
      embeds: [{
        title: `🚨 워크플로 실패: ${workflowName}`,
        ...(runUrl ? { url: runUrl } : {}),
        description: `${this.code(env.TITLE)}\n실행 #${this.code(env.RUN_ID)} (시도 ${this.code(env.RUN_ATTEMPT)})`,
        color: FAILURE_COLOR,
        fields,
        footer: { text: `Bibbidi · GitHub Actions · ${repository}` },
        timestamp: new Date().toISOString(),
      }],
    };
  }

  private jobLines(jobs: WorkflowJob[]) {
    const lines = jobs.slice(0, MAX_LISTED_JOBS).map((job) => {
      const steps = (job.steps ?? [])
        .filter((step) => step.conclusion === "failure" || step.conclusion === "timed_out")
        .slice(0, MAX_LISTED_STEPS)
        .map((step) => this.code(step.name));
      return steps.length > 0 ? `• ${this.code(job.name)} → ${steps.join(", ")}` : `• ${this.code(job.name)}`;
    });
    const rest = jobs.length - MAX_LISTED_JOBS;
    return (rest > 0 ? [...lines, `• 외 ${rest}개`] : lines).join("\n");
  }

  /** 외부에서 정할 수 있는 값을 코드 표기로 감싼다. 백틱, 줄바꿈, 마크다운 링크가 되지 않게 한다. */
  private code(value: string | undefined) {
    return `\`${this.shorten(value || "알 수 없음")}\``;
  }

  /** 코드 표기를 쓸 수 없는 제목용으로 링크가 될 수 있는 문자를 뺀다. */
  private plain(value: string) {
    return this.shorten(value).replace(/[[\]()<>]/g, " ").replace(/\s+/g, " ").trim();
  }

  private shorten(value: string) {
    const normalized = value.replace(/[`\r\n]+/g, " ").replace(/\s+/g, " ").trim();
    return normalized.length > MAX_NAME_CHARACTERS ? `${normalized.slice(0, MAX_NAME_CHARACTERS - 1)}…` : normalized;
  }

  private commit(repository: string, sha: string | undefined) {
    if (!sha || !/^[0-9a-f]{7,40}$/i.test(sha)) return this.code(sha);
    return `[\`${sha.slice(0, 7)}\`](https://github.com/${repository}/commit/${sha})`;
  }

  private actor(login: string | undefined) {
    if (!login || !/^[A-Za-z0-9][A-Za-z0-9-]*(\[bot\])?$/.test(login)) return this.code(login);
    return `[${login.replace(/\[bot\]$/, "")}](https://github.com/${login.replace(/\[bot\]$/, "")})`;
  }

  private pullRequest(repository: string, number: string | undefined) {
    if (!number || !/^\d+$/.test(number)) return undefined;
    return `[#${number}](https://github.com/${repository}/pull/${number})`;
  }

  /** 워크플로가 넘긴 실행 주소가 이 저장소의 GitHub 주소일 때만 링크로 쓴다. */
  private trustedUrl(url: string | undefined, repository: string) {
    return url && url.startsWith(`https://github.com/${repository}/actions/runs/`) ? url : undefined;
  }
}
