import { loadMembers, type Member } from "./member-configuration-parser.ts";

const WEBHOOK_CHANNELS: Record<string, string> = {
  "release-be": "BE",
  "release-fe": "FE",
  "release-app": "APP",
};

const RETRY_COUNT = 3;
const RETRY_DELAY_MS = 2_000;

export function channelForBaseBranch(baseBranch: string): string | undefined {
  return WEBHOOK_CHANNELS[baseBranch];
}

function eventFor(eventName: string, action: string, merged: boolean): EventDescription | undefined {
  if (eventName === "pull_request_review" && action === "submitted") {
    return { text: "에 리뷰를 남겼습니다." };
  }

  switch (action) {
    case "opened":
      return { text: "을 생성했습니다." };
    case "synchronize":
      return { text: "에 새로운 커밋을 남겼습니다." };
    case "reopened":
      return { text: "을 다시 열었습니다." };
    case "closed":
      return merged ? { text: "을 머지했습니다." } : undefined;
    default:
      return undefined;
  }
}

function nicknameFor(login: string, members: Member[]): string {
  return members.find((member) => member.github === login)?.nickname ?? login;
}

function typeLabel(labels: Label[]): string {
  const label = labels.find((item) => item.name?.startsWith("type:"))?.name;
  return label?.slice("type:".length).trim() || "none";
}

export function buildPayload(input: NotificationInput, members: Member[]): DiscordPayload | undefined {
  const event = eventFor(input.eventName, input.action, input.merged);
  if (!event) return undefined;
  const actor = nicknameFor(input.actor, members);
  return {
    content: `${actor}님이 [#${input.number} : ${input.title}](${input.url})${event.text}\ntype: ${typeLabel(input.labels)}`,
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
  };
}

export async function sendPayload(webhook: string, payload: DiscordPayload | undefined): Promise<void> {
  if (!payload) return;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= RETRY_COUNT; attempt += 1) {
    try {
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) return;
      lastError = new Error(`Discord 웹훅 요청에 실패했습니다. (상태 코드: ${response.status})`);
    } catch (error) {
      lastError = new Error("Discord 웹훅 요청 중 네트워크 오류가 발생했습니다.");
    }

    if (attempt < RETRY_COUNT) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  throw lastError ?? new Error("Discord 웹훅 요청에 실패했습니다.");
}

export async function main(environment = process.env): Promise<void> {
  const input = inputFromEnvironment(environment);
  const channel = channelForBaseBranch(input.base);
  if (!channel) return;

  const webhook = environment[`DISCORD_WEBHOOK_${channel}`];
  if (!webhook) {
    console.warn(`::warning::${channel} 채널의 Discord 웹훅 시크릿이 설정되지 않았습니다.`);
    return;
  }

  const members = loadMembers(environment.PR_NOTIFICATION_MEMBERS_JSON);
  await sendPayload(webhook, buildPayload(input, members));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

type Label = {
  name?: string;
};

type EventDescription = {
  text: string;
};

type DiscordPayload = {
  content: string;
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
};
