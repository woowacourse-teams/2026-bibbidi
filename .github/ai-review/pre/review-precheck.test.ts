import assert from "node:assert/strict";
import { test } from "node:test";
import { BotComments } from "../common/comment/bot-comments.ts";
import { LinkedIssue } from "../common/gate/linked-issue.ts";
import { ReviewPrecheck, type PrecheckContext } from "../common/gate/review-precheck.ts";
import { StaleHeadError } from "../common/stale-head-error.ts";
import type { GitHubApi } from "../../github/github-api.ts";

function context(path = "APP/androidApp/build.gradle.kts", added = "val environment = 1"): PrecheckContext {
  const files = [{
    filename: path,
    status: "modified",
    additions: 1,
    deletions: 0,
    patch: `@@ -1,0 +1 @@\n+${added}`,
  }];
  return {
    pullRequest: {
      number: 793,
      title: "[#792] App automation",
      body: "Describe the concrete app configuration and verification requirements. ".repeat(4),
      html_url: "https://example.invalid/pull/793",
      url: "https://example.invalid/pulls/793",
      created_at: "2026-11-05T00:00:00Z",
      base: { ref: "dev-app", sha: "base" },
      head: { ref: "chore/792", sha: "current-head" },
      requested_reviewers: [],
      draft: false,
      user: { login: "developer" },
      labels: [{ name: "type: chore" }],
    },
    allFiles: files,
    files,
    pullRequestComments: [],
    linkedIssue: new LinkedIssue(792, {
      number: 792,
      title: "App automation",
      body: "Restore app review and preserve work branches referenced by other open requests. ".repeat(4),
    }, []),
  };
}

function precheck() {
  return new ReviewPrecheck({} as GitHubApi, 793, "current-head");
}

test("an ordinary app PR with issue context is eligible for AI review", () => {
  assert.deepEqual(precheck().decide(context()), { proceed: true, warnings: [] });
});

test("missing issue context prevents external review", () => {
  const value = context();
  value.linkedIssue = new LinkedIssue(undefined, undefined, []);
  const result = precheck().decide(value);
  assert.equal(result.proceed, false);
  if (!result.proceed) assert.equal(result.reason, "NO_ISSUE");
});

test("review harness changes require human review instead of reviewing themselves", () => {
  const result = precheck().decide(context(".github/ai-review/pre/cli.ts"));
  assert.equal(result.proceed, false);
  if (!result.proceed) assert.equal(result.reason, "PROTECTED_PATHS");
});

test("suspected private key data prevents external review without returning the value", () => {
  const marker = ["-----BEGIN", "PRIVATE KEY-----"].join(" ");
  const result = precheck().decide(context("APP/config.txt", marker));
  assert.equal(result.proceed, false);
  if (!result.proceed) {
    assert.equal(result.reason, "SECRET_FOUND");
    assert.ok(!result.message.includes(marker));
  }
});

test("a new PR head prevents stale review context from being loaded", async () => {
  const github = {
    getPullRequest: async () => ({ ...context().pullRequest, head: { sha: "new-head" } }),
    getPullRequestFiles: async () => [],
    getIssueComments: async () => [],
  } as unknown as GitHubApi;
  await assert.rejects(new ReviewPrecheck(github, 793, "current-head").load(), StaleHeadError);
});

test("only a bot's completed review marker prevents duplicate model calls", () => {
  const body = "<!-- bibbidi-ai-review:summary -->\n<!-- bibbidi-ai-review:sha=old-head -->";
  for (const [user, expected] of [
    [{ login: "review[bot]", type: "Bot" }, true],
    [{ login: "developer", type: "User" }, false],
  ] as const) {
    assert.equal(new BotComments({} as GitHubApi, 793, [{ body, user }]).hasCompletedReview(), expected);
  }
});
