import assert from "node:assert/strict";
import { test } from "node:test";
import type { PullRequest } from "../github/github-types.ts";
import { closingIssueNumbers, PullRequestLifecycle, type LifecycleApi } from "./pr-lifecycle.ts";

const repository = "woowacourse-teams/2026-bibbidi";

function pullRequest(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    number: 790,
    title: "[#240] App configuration",
    body: "Refs #240",
    html_url: "https://example.invalid/pull/790",
    url: "https://example.invalid/pulls/790",
    created_at: "2026-11-04T10:00:00Z",
    merged_at: "2026-11-04T11:00:00Z",
    draft: false,
    user: { login: "developer" },
    base: { ref: "dev-app", sha: "base" },
    head: { ref: "chore/240", sha: "merged-head", repo: { full_name: repository } },
    requested_reviewers: [],
    ...overrides,
  };
}

function fixture(overrides: Partial<LifecycleApi> = {}, open: PullRequest[] = []) {
  const deleted: string[] = [];
  const closed: number[] = [];
  const api: LifecycleApi = {
    getClosingIssueNumbers: async () => [],
    getIssue: async (number) => ({ number, title: "App work", state: "open" }),
    getIssueEvents: async () => [],
    closeIssue: async (number) => { closed.push(number); },
    getBranchRef: async (name) => ({ ref: `refs/heads/${name}`, object: { sha: "merged-head" } }),
    deleteBranch: async (name) => { deleted.push(name); },
    ...overrides,
  };
  return { lifecycle: new PullRequestLifecycle(api, repository, open), deleted, closed };
}

test("a merged app PR deletes its unchanged work branch but keeps a Refs issue open", async () => {
  const { lifecycle, deleted, closed } = fixture();
  await lifecycle.handle(pullRequest(), false);
  assert.deepEqual(deleted, ["chore/240"]);
  assert.deepEqual(closed, []);
});

test("dry run reports cleanup without deleting branches or closing issues", async () => {
  const { lifecycle, deleted, closed } = fixture();
  const messages = await lifecycle.handle(pullRequest({ body: "Closes #240" }), true);
  assert.deepEqual(deleted, []);
  assert.deepEqual(closed, []);
  assert.ok(messages.some((message) => message.includes("삭제 대상")));
  assert.ok(messages.some((message) => message.includes("종료 대상")));
});

test("a branch changed after merge is preserved", async () => {
  const { lifecycle, deleted } = fixture({
    getBranchRef: async (name) => ({ ref: `refs/heads/${name}`, object: { sha: "new-work" } }),
  });
  await lifecycle.handle(pullRequest(), false);
  assert.deepEqual(deleted, []);
});

for (const usage of ["head", "base"] as const) {
  test(`a branch used as another open PR's ${usage} is preserved`, async () => {
    const open = pullRequest({ number: 791, merged_at: null });
    if (usage === "base") {
      open.base.ref = "chore/240";
      open.head.ref = "fix/791";
    }
    const { lifecycle, deleted } = fixture({}, [open]);
    await lifecycle.handle(pullRequest(), false);
    assert.deepEqual(deleted, []);
  });
}

test("unmerged PRs, fork branches and long-lived branches are preserved", async () => {
  for (const pr of [
    pullRequest({ merged_at: null }),
    pullRequest({ head: { ref: "chore/240", sha: "merged-head", repo: { full_name: "other/fork" } } }),
    pullRequest({ head: { ref: "release-app", sha: "merged-head", repo: { full_name: repository } } }),
  ]) {
    const { lifecycle, deleted, closed } = fixture();
    await lifecycle.handle(pr, false);
    assert.deepEqual(deleted, []);
    assert.deepEqual(closed, []);
  }
});

test("an issue reopened after merge is preserved", async () => {
  const { lifecycle, closed } = fixture({
    getIssueEvents: async () => [{ event: "reopened", created_at: "2026-11-04T12:00:00Z" }],
  });
  await lifecycle.handle(pullRequest({ body: "Closes #240" }), false);
  assert.deepEqual(closed, []);
});

test("closing issue references exclude Refs, code blocks and other repositories", () => {
  const body = "Refs #240\nCloses #792\nFixes other/repo#793\n```text\nCloses #794\n```";
  assert.deepEqual(closingIssueNumbers(body, repository), [792]);
});
