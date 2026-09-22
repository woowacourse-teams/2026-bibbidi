import assert from "node:assert/strict";
import test from "node:test";
import {
  assignmentTime,
  dueReminderStage,
  isBusinessTime,
  reminderMarker,
  reminderTargets,
} from "./review-reminder.ts";

const pullRequest = {
  number: 222, title: "알림 개선", html_url: "https://github.test/222", url: "https://api.github.test/222",
  created_at: "2026-09-22T00:00:00Z", draft: false, user: { login: "author" },
  base: { ref: "dev-be" }, head: { ref: "chore/222" },
  requested_reviewers: [{ login: "reviewed" }, { login: "waiting" }],
};

test("어떤 상태든 리뷰를 제출한 사용자는 리마인더 대상에서 제외한다", () => {
  assert.deepEqual(
    reminderTargets(pullRequest, [{ user: { login: "reviewed" }, state: "COMMENTED" }]),
    ["waiting"],
  );
});

test("가장 최근 리뷰 요청 이벤트를 배정 시각으로 사용한다", () => {
  const assigned = assignmentTime("waiting", [
    { event: "review_requested", created_at: "2026-09-22T01:00:00Z", requested_reviewer: { login: "waiting" } },
    { event: "review_requested", created_at: "2026-09-22T03:00:00Z", requested_reviewer: { login: "waiting" } },
  ], pullRequest.created_at);
  assert.equal(assigned.toISOString(), "2026-09-22T03:00:00.000Z");
});

test("배정 경과 시간에 따라 4시간과 12시간 단계를 선택한다", () => {
  const assigned = new Date("2026-09-22T00:00:00Z");
  assert.equal(dueReminderStage(assigned, new Date("2026-09-22T03:59:00Z")), undefined);
  assert.equal(dueReminderStage(assigned, new Date("2026-09-22T04:00:00Z")), "4h");
  assert.equal(dueReminderStage(assigned, new Date("2026-09-22T12:00:00Z")), "12h");
});

test("한국 시간 평일 08시부터 22시 전까지만 발송한다", () => {
  assert.equal(isBusinessTime(new Date("2026-09-21T23:00:00Z"), false), true);
  assert.equal(isBusinessTime(new Date("2026-09-22T13:00:00Z"), false), false);
  assert.equal(isBusinessTime(new Date("2026-09-19T03:00:00Z"), false), false);
  assert.equal(isBusinessTime(new Date("2026-09-22T03:00:00Z"), true), false);
});

test("중복 방지 표식에 PR, 리뷰어와 단계를 포함한다", () => {
  assert.equal(reminderMarker(222, "reviewer", "4h"), "Bibbidi · PR #222 · reviewer · 4h 리뷰 리마인더");
});
