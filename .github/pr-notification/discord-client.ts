export type DiscordEmbed = {
  title: string;
  description: string;
  url?: string;
  color: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer: { text: string };
  timestamp: string;
};

type DiscordMessage = {
  author?: { bot?: boolean };
  embeds?: Array<{ footer?: { text?: string } }>;
};

type DiscordErrorBody = {
  code?: number;
  message?: string;
};

export class DiscordRequestError extends Error {
  readonly status: number;
  readonly code?: number;

  constructor(
    message: string,
    status: number,
    code?: number,
  ) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function discordRequest<T>(
  url: string,
  token: string,
  options: RequestInit,
): Promise<T | undefined> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => undefined) as DiscordErrorBody | undefined;
    const detail = body?.code ? `, Discord 코드: ${body.code}` : "";
    throw new DiscordRequestError(
      `Discord API 요청에 실패했습니다. (상태 코드: ${response.status}${detail})`,
      response.status,
      body?.code,
    );
  }

  if (response.status === 204) return undefined;
  return await response.json() as T;
}

export async function openDirectMessage(token: string, discordUserId: string): Promise<string> {
  const channel = await discordRequest<{ id: string }>(
    "https://discord.com/api/v10/users/@me/channels",
    token,
    { method: "POST", body: JSON.stringify({ recipient_id: discordUserId }) },
  );
  if (!channel?.id) throw new Error("Discord DM 채널 ID를 받지 못했습니다.");
  return channel.id;
}

export async function hasDirectMessageMarker(
  token: string,
  channelId: string,
  marker: string,
): Promise<boolean> {
  const messages = await discordRequest<DiscordMessage[]>(
    `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`,
    token,
    { method: "GET" },
  );
  return (messages ?? []).some((message) => (
    message.author?.bot === true
    && message.embeds?.some((embed) => embed.footer?.text === marker)
  ));
}

export async function sendDirectMessageOnce({
  token,
  discordUserId,
  marker,
  embed,
}: {
  token: string;
  discordUserId: string;
  marker: string;
  embed: DiscordEmbed;
}): Promise<"sent" | "duplicate"> {
  const channelId = await openDirectMessage(token, discordUserId);
  if (await hasDirectMessageMarker(token, channelId, marker)) return "duplicate";

  await discordRequest(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    token,
    { method: "POST", body: JSON.stringify({ embeds: [{ ...embed, footer: { text: marker } }] }) },
  );
  return "sent";
}

export async function sendWebhook(webhook: string, payload: unknown): Promise<void> {
  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Discord 웹훅 요청에 실패했습니다. (상태 코드: ${response.status})`);
  }
}
