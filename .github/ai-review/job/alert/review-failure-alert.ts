import { channelForBaseBranch, sendPayload } from "../../../pr-notification/discord-pr-notification.ts";

const MAX_TITLE_CHARACTERS = 100;
const MAX_REASON_CHARACTERS = 300;
const FAILURE_COLOR = 0xed4245;

export type FailureAlertInput = {
  pullNumber: number;
  title: string;
  baseBranch: string;
  pullRequestUrl: string;
  runUrl?: string;
  stage: string;
  reason: string;
};

export type AlertResult = "sent" | "no-channel" | "no-webhook" | "failed";

/**
 * AI 리뷰 봇이 실패했을 때 PR 알림과 같은 분야별 Discord 채널에 알린다.
 * 전송 함수와 채널 선택은 PR 알림 코드를 재사용하고, 알림이 실패해도 리뷰 결과에는 영향을 주지 않는다.
 */
export class ReviewFailureAlert {
  private readonly environment: NodeJS.ProcessEnv;

  constructor(environment: NodeJS.ProcessEnv) {
    this.environment = environment;
  }

  async send(input: FailureAlertInput): Promise<AlertResult> {
    const channel = channelForBaseBranch(input.baseBranch);
    if (!channel) return "no-channel";

    const webhook = this.environment[`DISCORD_WEBHOOK_${channel}`];
    if (!webhook) {
      console.warn(`::warning title=AI review alert skipped::${channel} 채널의 Discord 웹훅 시크릿이 설정되지 않았습니다.`);
      return "no-webhook";
    }

    try {
      await sendPayload(webhook, this.payload(input));
      return "sent";
    } catch (error) {
      const reason = error instanceof Error ? error.message : "알 수 없는 오류";
      console.warn(`::warning title=AI review alert failed::${reason}`);
      return "failed";
    }
  }

  private payload(input: FailureAlertInput) {
    const fields = [
      { name: "🧭 실패한 단계", value: input.stage, inline: true },
      { name: "🌿 대상 브랜치", value: `\`${input.baseBranch}\``, inline: true },
      { name: "📝 원인", value: `\`\`\`${this.shorten(input.reason, MAX_REASON_CHARACTERS)}\`\`\``, inline: false },
    ];
    if (input.runUrl) fields.push({ name: "🔎 실행 로그", value: `[워크플로 실행 보기 ↗](${input.runUrl})`, inline: false });

    return {
      username: "Bibbidi AI 리뷰 알리미",
      allowed_mentions: { parse: [], users: [] },
      embeds: [{
        title: `⚠️ #${input.pullNumber} AI 리뷰 실패`,
        url: input.pullRequestUrl,
        description: [
          `### ${this.shorten(input.title, MAX_TITLE_CHARACTERS)}`,
          `[GitHub에서 PR 보기 ↗](${input.pullRequestUrl})`,
          "",
          "리뷰 봇 쪽 문제로 리뷰하지 못했습니다. 머지는 막지 않으며, 새 커밋을 올리거나 워크플로를 다시 실행하면 재시도합니다.",
        ].join("\n"),
        color: FAILURE_COLOR,
        fields,
        footer: { text: `Bibbidi · AI 리뷰 · PR #${input.pullNumber}` },
        timestamp: new Date().toISOString(),
      }],
    };
  }

  private shorten(value: string, limit: number) {
    const normalized = value.replace(/`/g, "'").replace(/\s+/g, " ").trim();
    return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
  }
}
