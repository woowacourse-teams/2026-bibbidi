import assert from "node:assert/strict";
import test from "node:test";
import { buildPayload, type NotificationInput } from "./discord-pr-notification.ts";

const input: NotificationInput = {
  eventName: "pull_request_review", action: "submitted", merged: false,
  number: "222", title: "알림 개선", url: "https://github.test/222",
  head: "chore/222", base: "dev-be", actor: "reviewer", author: "author",
  labels: [], reviewState: "commented", commentBody: "확인했습니다.",
};

test("단순 리뷰 코멘트는 댓글 작성자를 포함한 문장형 제목을 사용한다", () => {
  const payload = buildPayload(input, [
    { github: "reviewer", nickname: "리뷰어" },
    { github: "author", nickname: "작성자" },
  ]);
  assert.equal(payload?.embeds[0].title, "#222 알림 개선에 리뷰어님이 댓글을 남겼습니다");
});

test("리뷰어 지정 이벤트는 PR 알림으로 표시한다", () => {
  const payload = buildPayload({ ...input, eventName: "pull_request", action: "review_requested", requestedReviewer: "reviewer" }, []);
  assert.match(payload?.embeds[0].description ?? "", /리뷰어를 지정했습니다/);
});
