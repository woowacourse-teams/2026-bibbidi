import { loadMembers } from "./member-configuration-parser.ts";

const kst = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  weekday: "short",
  hour: "2-digit",
  hour12: false,
});
const env = process.env;
const githubHeaders = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${env.GITHUB_TOKEN}`,
  "X-GitHub-Api-Version": "2022-11-28",
};

async function json(url: string, options: RequestInit = {}) {
  const response = await fetch(url, options);
  if (!response.ok)
    throw new Error(`요청에 실패했습니다. (상태 코드: ${response.status})`);
  return response.json();
}
async function isHoliday(date: Date) {
  const holidays: Array<{ date: string }> = await json(
    `https://date.nager.at/api/v3/PublicHolidays/${date.getUTCFullYear()}/KR`,
  );
  return holidays.some(
    (holiday) =>
      holiday.date ===
      date.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }),
  );
}
function reminderTargets(pr: any, reviews: Array<any>) {
  const reviewed = new Set(reviews.map((review) => review.user.login));
  const requested = pr.requested_reviewers
    .map((reviewer: any) => reviewer.login)
    .filter((login: string) => !reviewed.has(login));
  return requested.length ? requested : [pr.user.login];
}
async function sendChannel(webhook: string | undefined, content: string) {
  if (webhook)
    await json(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
}
function eligible(
  created: string,
  now: Date,
  day: string,
  hour: number,
  holiday: boolean,
) {
  const age = now.getTime() - new Date(created).getTime();
  if (holiday || day === "Sat" || day === "Sun")
    return age >= 4 * 3600000 && (hour === 13 || hour === 18);
  const opened = new Date(created);
  const openedHour = Number(
    opened.toLocaleString("en-US", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      hour12: false,
    }),
  );
  if (openedHour > 18) return (age >= 0 && hour === 8) || hour === 10;
  return age >= 4 * 3600000 && age < 5 * 3600000 && hour >= 8 && hour <= 22;
}

async function main() {
  const now = new Date();
  const parts = Object.fromEntries(
    kst.formatToParts(now).map((part) => [part.type, part.value]),
  );
  const hour = Number(parts.hour);
  const members = loadMembers(env.PR_NOTIFICATION_MEMBERS_JSON);
  const holiday = await isHoliday(now);
  const pulls: Array<any> = await json(
    `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/pulls?state=open&sort=created&direction=desc&per_page=30`,
    { headers: githubHeaders },
  );
  for (const pr of pulls) {
    if (pr.draft || !eligible(pr.created_at, now, parts.weekday, hour, holiday))
      continue;
    const reviews: Array<any> = await json(`${pr.url}/reviews`, {
      headers: githubHeaders,
    });
    for (const login of reminderTargets(pr, reviews)) {
      const member = members.find((item) => item.github === login);
      const message = `<@${member?.discordUserId ?? ""}> #${pr.number} ${pr.title} 리뷰를 확인해 주세요: ${pr.html_url}`;
      if (member?.discordUserId && env.DISCORD_BOT_TOKEN) {
        const dm: any = await json(
          "https://discord.com/api/v10/users/@me/channels",
          {
            method: "POST",
            headers: {
              Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ recipient_id: member.discordUserId }),
          },
        );
        await json(`https://discord.com/api/v10/channels/${dm.id}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: message }),
        });
      }
      const channel = {
        "release-be": "BE",
        "release-fe": "FE",
        "release-app": "APP",
      }[pr.base.ref];
      const webhook = env[`DISCORD_WEBHOOK_${channel}`];
      await sendChannel(webhook, message);
    }
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
