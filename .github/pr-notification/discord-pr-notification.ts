import { loadMembers, type Member } from "./member-configuration-parser.ts";
import { sendDirectMessageOnce, sendWebhook } from "./discord-client.ts";

const WEBHOOK_CHANNELS: Record<string, string> = {
  "dev-be": "BE",
  "dev-fe": "FE",
  "dev-app": "APP",
  "release-be": "BE",
  "release-fe": "FE",
  "release-app": "APP",
};

const RETRY_COUNT = 3;
const RETRY_DELAY_MS = 2_000;

export function channelForBaseBranch(baseBranch: string): string | undefined {
  return WEBHOOK_CHANNELS[baseBranch];
}

function eventFor(
  eventName: string,
  action: string,
  merged: boolean,
  reviewState: string | undefined,
): EventDescription | undefined {
  if (eventName === "pull_request_review" && action === "submitted") {
    switch (reviewState) {
      case "approved":
        return { title: "리뷰 승인", text: "PR을 승인했습니다.", color: 0x57f287, kind: "review" };
      case "changes_requested":
        return { title: "변경 요청", text: "수정이 필요한 내용을 남겼습니다.", color: 0xed4245, kind: "review" };
      default:
        return { title: "리뷰 코멘트", text: "리뷰 의견을 남겼습니다.", color: 0x3498db, kind: "comment" };
    }
  }

  if (eventName === "pull_request_review_comment" && action === "created") {
    return { title: "코드 댓글", text: "코드에 댓글을 남겼습니다.", color: 0xfaa61a, kind: "comment" };
  }

  switch (action) {
    case "opened":
      return { title: "PR 생성", text: "새로운 PR을 생성했습니다.", color: 0x5865f2, kind: "pull_request" };
    case "synchronize":
      return { title: "커밋 추가", text: "PR에 새로운 커밋을 추가했습니다.", color: 0xfee75c, kind: "pull_request" };
    case "reopened":
      return { title: "PR 다시 열림", text: "닫혀 있던 PR을 다시 열었습니다.", color: 0x57f287, kind: "pull_request" };
    case "closed":
      return merged
        ? { title: "PR 머지", text: "PR을 머지했습니다.", color: 0xeb459e, kind: "pull_request" }
        : undefined;
    case "review_requested":
      return { title: "리뷰어 지정", text: "리뷰어를 지정했습니다.", color: 0x5865f2, kind: "pull_request" };
    default:
      return undefined;
  }
}

function nicknameFor(login: string, members: Member[]): string {
  return members.find((member) => member.github === login)?.nickname ?? login;
}

function typeLabel(labels: Label[]): string {
  const label = labels.find((item) => item.name?.startsWith("type:"))?.name;
  return label?.slice("type:".length).trim() || "미지정";
}

function reviewerLogins(value: string | undefined, assignedReviewer: string | undefined): string[] {
  const reviewers = labelsFromEnvironment(value)
    .flatMap((reviewer) => reviewer.login ? [reviewer.login] : []);
  if (assignedReviewer) reviewers.push(assignedReviewer);
  return [...new Set(reviewers)];
}

function reviewerField(reviewers: string[], members: Member[]): string {
  if (reviewers.length === 0) return "_지정되지 않음_";

  return reviewers
    .map((login) => {
      const member = members.find((item) => item.github === login);
      if (!member) return `- [@${login}](https://github.com/${login})`;
      if (member.discordUserId) {
        return `- **${member.nickname}** · <@${member.discordUserId}> (\`@${login}\`)`;
      }
      return `- **${member.nickname}** · [\`@${login}\`](https://github.com/${login})`;
    })
    .join("\n");
}

function commentPreview(body: string | undefined): string {
  const normalized = body?.trim();
  if (!normalized) return "> _내용 없이 상태만 등록했습니다._";
  const limit = 900;
  const preview = normalized.length > limit ? `${normalized.slice(0, limit)}…` : normalized;
  return preview
    .split("\n")
    .map((line) => `> ${line || " "}`)
    .join("\n");
}

export function buildPayload(input: NotificationInput, members: Member[]): DiscordPayload | undefined {
  const event = eventFor(input.eventName, input.action, input.merged, input.reviewState);
  if (!event) return undefined;
  const actor = nicknameFor(input.actor, members);
  const author = nicknameFor(input.author, members);
  const reviewers = reviewerLogins(input.requestedReviewersJson, input.assignedReviewer ?? input.requestedReviewer);
  const reviewerDiscordIds = reviewers.flatMap((login) => {
    const discordUserId = members.find((member) => member.github === login)?.discordUserId;
    return discordUserId ? [discordUserId] : [];
  });
  const destinationUrl = event.kind === "pull_request" ? input.url : (input.commentUrl || input.url);
  const authorMarkdown = `**${author}** · [\`@${input.author}\`](https://github.com/${input.author})`;
  const actorMarkdown = `**${actor}** · [\`@${input.actor}\`](https://github.com/${input.actor})`;

  const fields: DiscordEmbedField[] = event.kind === "pull_request"
    ? [
        { name: "👤 작성자", value: authorMarkdown, inline: true },
        { name: "🏷️ 변경 유형", value: `**\`${typeLabel(input.labels)}\`**`, inline: true },
        { name: "👀 리뷰어", value: reviewerField(reviewers, members), inline: false },
        { name: "🌿 변경 흐름", value: `\`${input.head}\` **→** \`${input.base}\``, inline: false },
      ]
    : [
        { name: "💬 리뷰 작성자", value: actorMarkdown, inline: true },
        { name: "👤 PR 작성자", value: authorMarkdown, inline: true },
        { name: "📝 내용", value: commentPreview(input.commentBody), inline: false },
        { name: "🌿 변경 흐름", value: `\`${input.head}\` **→** \`${input.base}\``, inline: false },
      ];

  return {
    username: "Bibbidi PR 알리미",
    allowed_mentions: {
      parse: [],
      users: reviewerDiscordIds,
    },
    embeds: [{
      title: event.kind === "pull_request"
        ? `#${input.number} · ${input.title}`
        : event.kind === "comment"
          ? `#${input.number} ${input.title}에 ${actor}님이 댓글을 남겼습니다`
          : `[${event.title}] #${input.number} · ${input.title}`,
      url: destinationUrl,
      description: `### ${event.title}\n**${actor}**님이 ${event.text}\n[GitHub에서 확인하기 ↗](${destinationUrl})`,
      color: event.color,
      fields,
      footer: { text: `GitHub PR #${input.number}` },
      timestamp: new Date().toISOString(),
    }],
  };
}

function labelsFromEnvironment(value: string | undefined): Label[] {
  if (!value) return [];

  try {
    const labels: unknown = JSON.parse(value);
    return Array.isArray(labels) ? labels : [];
  } catch {
    console.warn("::warning::PR 라벨 정보를 해석하지 못했습니다.");
    return [];
  }
}

function inputFromEnvironment(environment: NodeJS.ProcessEnv): NotificationInput {
  return {
    eventName: environment.EVENT_NAME ?? "pull_request",
    action: environment.ACTION ?? "",
    merged: environment.MERGED === "true",
    number: environment.NUMBER ?? "",
    title: environment.TITLE ?? "",
    url: environment.URL ?? "",
    head: environment.HEAD ?? "",
    base: environment.BASE ?? "",
    actor: environment.ACTOR ?? "",
    author: environment.AUTHOR ?? "",
    labels: labelsFromEnvironment(environment.LABELS_JSON),
    requestedReviewersJson: environment.REQUESTED_REVIEWERS_JSON,
    assignedReviewer: environment.ASSIGNED_REVIEWER,
    requestedReviewer: environment.REQUESTED_REVIEWER,
    reviewState: environment.REVIEW_STATE,
    commentBody: environment.COMMENT_BODY,
    commentUrl: environment.COMMENT_URL,
  };
}

export async function sendPayload(webhook: string, payload: DiscordPayload | undefined): Promise<void> {
  if (!payload) return;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= RETRY_COUNT; attempt += 1) {
    try {
      await sendWebhook(webhook, payload);
      return;
    } catch (error) {
      lastError = error instanceof Error
        ? error
        : new Error("Discord 웹훅 요청 중 네트워크 오류가 발생했습니다.");
    }

    if (attempt < RETRY_COUNT) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  throw lastError ?? new Error("Discord 웹훅 요청에 실패했습니다.");
}

function immediateReviewMarker(input: NotificationInput, reviewer: string) {
  return `Bibbidi · PR #${input.number} · ${reviewer} · 리뷰 요청`;
}

function immediateReviewEmbed(input: NotificationInput, reviewer: Member) {
  return {
    title: `👀 #${input.number} 리뷰 요청`,
    description: [
      `**${reviewer.nickname}**님이 \`${input.head}\` → \`${input.base}\` PR의 리뷰어로 지정되었습니다.`,
      "",
      `### ${input.title}`,
      `[GitHub에서 리뷰하기 ↗](${input.url})`,
    ].join("\n"),
    url: input.url,
    color: 0x5865f2,
    fields: [
      { name: "👤 작성자", value: `[@${input.author}](https://github.com/${input.author})`, inline: true },
      { name: "🌿 변경 흐름", value: `\`${input.head}\` **→** \`${input.base}\``, inline: true },
    ],
    footer: { text: immediateReviewMarker(input, reviewer.github) },
    timestamp: new Date().toISOString(),
  };
}

async function sendImmediateReviewDm(input: NotificationInput, members: Member[], token: string | undefined) {
  const reviewerLogin = input.assignedReviewer ?? input.requestedReviewer;
  if (!reviewerLogin) return;
  const reviewer = members.find((member) => member.github === reviewerLogin);
  if (!reviewer?.discordUserId) {
    throw new Error(`리뷰어 @${reviewerLogin}의 Discord 사용자 ID가 설정되지 않았습니다.`);
  }
  if (!token) throw new Error("DISCORD_BOT_TOKEN 시크릿이 설정되지 않았습니다.");

  const result = await sendDirectMessageOnce({
    token,
    discordUserId: reviewer.discordUserId,
    marker: immediateReviewMarker(input, reviewer.github),
    embed: immediateReviewEmbed(input, reviewer),
  });
  console.info(`리뷰 요청 DM ${result === "sent" ? "발송 완료" : "중복 발송 생략"}: @${reviewerLogin}`);
}

function immediateFailurePayload(input: NotificationInput, reason: string) {
  const reviewer = input.assignedReviewer ?? input.requestedReviewer ?? "unknown";
  return {
    username: "Bibbidi PR 알리미",
    content: `⚠️ [@${reviewer}](https://github.com/${reviewer})님에게 **#${input.number} ${input.title}** 리뷰 요청 DM을 보내지 못했습니다.\n${reason}\n${input.url}`,
    allowed_mentions: { parse: [] },
  };
}

export async function main(environment = process.env): Promise<void> {
  const input = inputFromEnvironment(environment);
  const channel = channelForBaseBranch(input.base);
  if (!channel) return;

  const webhook = environment[`DISCORD_WEBHOOK_${channel}`];
  if (!webhook) {
    throw new Error(`${channel} 채널의 Discord 웹훅 시크릿이 설정되지 않았습니다.`);
  }

  const members = loadMembers(environment.PR_NOTIFICATION_MEMBERS_JSON);
  await sendPayload(webhook, buildPayload(input, members));
  try {
    await sendImmediateReviewDm(input, members, environment.DISCORD_BOT_TOKEN);
  } catch (error) {
    const failure = error instanceof Error ? error : new Error("알 수 없는 Discord DM 오류가 발생했습니다.");
    await sendWebhook(webhook, immediateFailurePayload(input, failure.message));
    throw failure;
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

type Label = {
  name?: string;
  login?: string;
};

type EventDescription = {
  title: string;
  text: string;
  color: number;
  kind: "pull_request" | "review" | "comment";
};

type DiscordEmbedField = { name: string; value: string; inline: boolean };

type DiscordPayload = {
  username: string;
  allowed_mentions: {
    parse: string[];
    users: string[];
  };
  embeds: Array<{
    title: string;
    url: string;
    description: string;
    color: number;
    fields: DiscordEmbedField[];
    footer: { text: string };
    timestamp: string;
  }>;
};

export type NotificationInput = {
  eventName: string;
  action: string;
  merged: boolean;
  number: string;
  title: string;
  url: string;
  head: string;
  base: string;
  actor: string;
  author: string;
  labels: Label[];
  requestedReviewersJson?: string;
  assignedReviewer?: string;
  requestedReviewer?: string;
  reviewState?: string;
  commentBody?: string;
  commentUrl?: string;
};
