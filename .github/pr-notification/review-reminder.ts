import { loadMembers, type Member } from "./member-configuration-parser.ts";
import { sendDirectMessageOnce, sendWebhook, type DiscordEmbed } from "./discord-client.ts";

type GitHubUser = { login: string };
type PullRequest = {
  number: number; title: string; html_url: string; url: string; created_at: string; draft: boolean;
  user: GitHubUser; base: { ref: string }; head: { ref: string }; requested_reviewers: GitHubUser[];
};
type Review = { user: GitHubUser; state: string };
type IssueEvent = { event: string; created_at: string; requested_reviewer?: GitHubUser };
export type ReminderStage = "4h" | "12h";

const KST = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul", weekday: "short", hour: "2-digit", hour12: false,
});
const CHANNELS: Record<string, string> = {
  "dev-be": "BE", "dev-fe": "FE", "dev-app": "APP",
  "release-be": "BE", "release-fe": "FE", "release-app": "APP",
};

async function githubJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, { headers: {
    Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  } });
  if (!response.ok) throw new Error(`GitHub API 요청에 실패했습니다. (상태 코드: ${response.status})`);
  return await response.json() as T;
}

async function isHoliday(date: Date): Promise<boolean> {
  const today = date.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${today.slice(0, 4)}/KR`);
  if (!response.ok) throw new Error(`공휴일 API 요청에 실패했습니다. (상태 코드: ${response.status})`);
  const holidays = await response.json() as Array<{ date: string }>;
  return holidays.some((holiday) => holiday.date === today);
}

export function reminderTargets(pr: PullRequest, reviews: Review[]): string[] {
  const reviewed = new Set(reviews.map((review) => review.user.login));
  return pr.requested_reviewers.map((reviewer) => reviewer.login).filter((login) => !reviewed.has(login));
}

export function assignmentTime(login: string, events: IssueEvent[], fallback: string): Date {
  const event = [...events].reverse().find((item) => (
    item.event === "review_requested" && item.requested_reviewer?.login === login
  ));
  return new Date(event?.created_at ?? fallback);
}

export function isBusinessTime(now: Date, holiday: boolean): boolean {
  const parts = Object.fromEntries(KST.formatToParts(now).map((part) => [part.type, part.value]));
  const hour = Number(parts.hour);
  return !holiday && parts.weekday !== "Sat" && parts.weekday !== "Sun" && hour >= 8 && hour < 22;
}

export function dueReminderStage(assignedAt: Date, now: Date): ReminderStage | undefined {
  const ageHours = (now.getTime() - assignedAt.getTime()) / 3_600_000;
  if (ageHours >= 12) return "12h";
  if (ageHours >= 4) return "4h";
  return undefined;
}

export function reminderMarker(prNumber: number, reviewer: string, stage: ReminderStage): string {
  return `Bibbidi · PR #${prNumber} · ${reviewer} · ${stage} 리뷰 리마인더`;
}

function reminderEmbed(pr: PullRequest, member: Member, stage: ReminderStage): DiscordEmbed {
  const elapsed = stage === "4h" ? "4시간" : "12시간";
  return {
    title: `⏰ #${pr.number} 리뷰 리마인더`,
    description: [`**${member.nickname}**님에게 요청된 리뷰가 ${elapsed} 동안 대기 중입니다.`, "", `### ${pr.title}`, `[GitHub에서 리뷰하기 ↗](${pr.html_url})`].join("\n"),
    url: pr.html_url,
    color: stage === "4h" ? 0xfee75c : 0xed4245,
    fields: [
      { name: "👤 작성자", value: `[@${pr.user.login}](https://github.com/${pr.user.login})`, inline: true },
      { name: "🌿 변경 흐름", value: `\`${pr.head.ref}\` **→** \`${pr.base.ref}\``, inline: true },
    ],
    footer: { text: reminderMarker(pr.number, member.github, stage) }, timestamp: new Date().toISOString(),
  };
}

function fallbackPayload(pr: PullRequest, login: string, reason: string) {
  return {
    username: "Bibbidi PR 알리미",
    content: `⚠️ [@${login}](https://github.com/${login})님에게 **#${pr.number} ${pr.title}** 리뷰 DM을 보내지 못했습니다.\n${reason}\n${pr.html_url}`,
    allowed_mentions: { parse: [] },
  };
}

function reminderChannelPayload(pr: PullRequest, member: Member, stage: ReminderStage) {
  const elapsed = stage === "4h" ? "4시간" : "12시간";
  return {
    username: "Bibbidi PR 알리미",
    content: `⏰ **${member.nickname}** · <@${member.discordUserId}>님, **#${pr.number} ${pr.title}** 리뷰가 ${elapsed} 동안 대기 중입니다.\n${pr.html_url}`,
    allowed_mentions: { parse: [], users: member.discordUserId ? [member.discordUserId] : [] },
  };
}

export async function main(environment = process.env, now = new Date()): Promise<void> {
  const repository = environment.GITHUB_REPOSITORY;
  const githubToken = environment.GITHUB_TOKEN;
  if (!repository || !githubToken) throw new Error("GitHub 저장소 정보 또는 토큰이 없습니다.");
  const members = loadMembers(environment.PR_NOTIFICATION_MEMBERS_JSON);
  if (!isBusinessTime(now, await isHoliday(now))) {
    console.info("현재는 리뷰 리마인더 발송 시간이 아닙니다.");
    return;
  }

  const pulls = await githubJson<PullRequest[]>(`https://api.github.com/repos/${repository}/pulls?state=open&sort=created&direction=desc&per_page=100`, githubToken);
  const failures: string[] = [];
  for (const pr of pulls) {
    if (pr.draft || !CHANNELS[pr.base.ref]) continue;
    const [reviews, events] = await Promise.all([
      githubJson<Review[]>(`${pr.url}/reviews?per_page=100`, githubToken),
      githubJson<IssueEvent[]>(`https://api.github.com/repos/${repository}/issues/${pr.number}/events?per_page=100`, githubToken),
    ]);
    for (const login of reminderTargets(pr, reviews)) {
      const stage = dueReminderStage(assignmentTime(login, events, pr.created_at), now);
      if (!stage) continue;
      const member = members.find((item) => item.github === login);
      const webhook = environment[`DISCORD_WEBHOOK_${CHANNELS[pr.base.ref]}`];
      let failure: Error | undefined;
      let sent = false;
      try {
        if (!member?.discordUserId) throw new Error(`@${login}의 Discord 사용자 ID가 설정되지 않았습니다.`);
        if (!environment.DISCORD_BOT_TOKEN) throw new Error("DISCORD_BOT_TOKEN 시크릿이 설정되지 않았습니다.");
        const result = await sendDirectMessageOnce({
          token: environment.DISCORD_BOT_TOKEN, discordUserId: member.discordUserId,
          marker: reminderMarker(pr.number, login, stage), embed: reminderEmbed(pr, member, stage),
        });
        console.info(`${stage} 리뷰 리마인더 ${result === "sent" ? "발송 완료" : "중복 발송 생략"}: #${pr.number} @${login}`);
        sent = result === "sent";
      } catch (error) {
        failure = error instanceof Error ? error : new Error("알 수 없는 Discord DM 오류가 발생했습니다.");
      }
      if (sent && webhook && member) await sendWebhook(webhook, reminderChannelPayload(pr, member, stage));
      if (failure && webhook) await sendWebhook(webhook, fallbackPayload(pr, login, failure.message));
      if (failure) failures.push(`#${pr.number} @${login}: ${failure.message}`);
    }
  }
  if (failures.length > 0) {
    for (const failure of failures) console.error(`::error::${failure}`);
    throw new Error(`Discord 개인 메시지 ${failures.length}건을 보내지 못했습니다.`);
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
