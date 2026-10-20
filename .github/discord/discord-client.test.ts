import assert from "node:assert/strict";
import test from "node:test";
import { sendDirectMessageOnce, sendWebhook } from "./discord-client.ts";

const embed = {
  title: "리뷰 요청", description: "확인해 주세요.", color: 1,
  footer: { text: "marker" }, timestamp: "2026-09-22T00:00:00.000Z",
};

test("최근 DM에 같은 표식이 있으면 메시지를 다시 보내지 않는다", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/users/@me/channels")) return Response.json({ id: "dm-1" });
    return Response.json([{ author: { bot: true }, embeds: [{ footer: { text: "marker" } }] }]);
  }) as typeof fetch;

  try {
    assert.equal(await sendDirectMessageOnce({ token: "token", discordUserId: "1", marker: "marker", embed }), "duplicate");
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Discord 웹훅의 204 응답을 성공으로 처리한다", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;
  try {
    await assert.doesNotReject(sendWebhook("https://discord.test/webhook", { content: "알림" }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
