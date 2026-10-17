import { sendWebhookWithRetry } from "../discord/discord-client.ts";

const FAILURE_COLOR = 0xed4245;

/**
 * Let's Encrypt 인증서 발급·갱신이 실패했을 때 GitHub Actions 실패 전용 Discord 채널에 알린다.
 * 웹훅이 없거나 전송에 실패해도 배포 결과는 바꾸지 않는다.
 */
export class TlsFailureAlert {
  private readonly environment: NodeJS.ProcessEnv;

  constructor(environment: NodeJS.ProcessEnv) {
    this.environment = environment;
  }

  async send() {
    const deploymentName = this.environment.DEPLOYMENT_NAME || "알 수 없음";
    console.warn(`::warning::TLS issue/renew failed for ${deploymentName}`);

    const webhook = this.environment.DISCORD_WEBHOOK_GITHUB_ACTION;
    if (!webhook) {
      console.warn("::warning::DISCORD_WEBHOOK_GITHUB_ACTION이 설정되지 않아 TLS 실패 알림을 보내지 않았습니다.");
      return "no-webhook" as const;
    }

    try {
      await sendWebhookWithRetry(webhook, this.payload(deploymentName));
      return "sent" as const;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "알 수 없는 오류";
      console.warn(`::warning::TLS 실패 알림 전송에 실패했습니다. ${reason}`);
      return "failed" as const;
    }
  }

  private payload(deploymentName: string) {
    const fields = [
      { name: "🚀 배포 환경", value: `\`${deploymentName}\``, inline: true },
      { name: "🏷️ 환경 구분", value: `\`${this.environment.DEPLOYMENT_ENVIRONMENT || "알 수 없음"}\``, inline: true },
    ];
    const runUrl = this.environment.RUN_URL;
    if (runUrl) fields.push({ name: "🔎 실행 로그", value: `[워크플로 실행 보기 ↗](${runUrl})`, inline: false });

    return {
      username: "Bibbidi 배포 알리미",
      allowed_mentions: { parse: [] },
      embeds: [{
        title: "⚠️ TLS 인증서 발급·갱신 실패",
        description: "Let's Encrypt 인증서 발급 또는 갱신에 실패했습니다. 배포는 계속 진행했습니다. 워크플로 로그를 확인해 주세요.",
        color: FAILURE_COLOR,
        fields,
        footer: { text: `Bibbidi · TLS · ${deploymentName}` },
        timestamp: new Date().toISOString(),
      }],
    };
  }
}
