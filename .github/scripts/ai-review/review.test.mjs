import assert from "node:assert/strict";
import test from "node:test";

import { runReview } from "./review.mjs";

test("runReview submits at most twenty validated inline comments", async () => {
  const patch = [
    "@@ -0,0 +1,25 @@",
    ...Array.from({ length: 25 }, (_, index) => `+line ${index + 1}`),
  ].join("\n");
  const pullRequest = {
    title: "test",
    body: "",
    base: { ref: "release-fe" },
    head: { ref: "feature/1", sha: "head-sha" },
  };
  let submittedReview;
  const github = {
    async getPullRequest() {
      return pullRequest;
    },
    async getPullRequestFiles() {
      return [
        {
          filename: "FE/src/example.ts",
          status: "added",
          additions: 25,
          deletions: 0,
          patch,
        },
      ];
    },
    async createReview(_pullNumber, review) {
      submittedReview = review;
      return review;
    },
  };
  let callCount = 0;
  const openai = {
    async review() {
      callCount += 1;
      if (callCount < 4) {
        return { summary: "stage", findings: [] };
      }
      return {
        summary: "final",
        findings: Array.from({ length: 25 }, (_, index) => ({
          severity: index % 2 === 0 ? "CAUTION" : "ADVICE",
          path: "FE/src/example.ts",
          side: "RIGHT",
          line: index + 1,
          title: `finding ${index + 1}`,
          explanation: "explanation",
          suggestion: "suggestion",
        })),
      };
    },
  };

  await runReview({
    github,
    openai,
    pullNumber: 1,
    expectedHeadSha: "head-sha",
  });

  assert.equal(callCount, 4);
  assert.equal(submittedReview.comments.length, 20);
  assert(submittedReview.comments.every((comment) => comment.path === "FE/src/example.ts"));
  assert.match(submittedReview.body, /인라인 코멘트: 20\/20/);
});
