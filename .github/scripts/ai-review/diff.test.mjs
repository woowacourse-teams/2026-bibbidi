import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDiffBundle,
  collectCommentableLines,
  selectValidFindings,
} from "./diff.mjs";

const files = [
  {
    filename: "src/example.js",
    status: "modified",
    additions: 2,
    deletions: 1,
    patch: "@@ -10,3 +10,4 @@\n context\n-old\n+new\n+added\n context2",
  },
];

test("collectCommentableLines maps left and right diff lines", () => {
  const lines = collectCommentableLines(files).get("src/example.js");

  assert(lines.has("LEFT:10"));
  assert(lines.has("RIGHT:10"));
  assert(lines.has("LEFT:11"));
  assert(lines.has("RIGHT:11"));
  assert(lines.has("RIGHT:12"));
  assert(lines.has("RIGHT:13"));
});

test("selectValidFindings removes invalid positions, sorts severity, and caps results", () => {
  const findings = [
    {
      severity: "ADVICE",
      path: "src/example.js",
      side: "RIGHT",
      line: 12,
      title: "이름 개선",
    },
    {
      severity: "REQUIRED",
      path: "src/example.js",
      side: "RIGHT",
      line: 11,
      title: "오동작",
    },
    {
      severity: "CAUTION",
      path: "src/missing.js",
      side: "RIGHT",
      line: 1,
      title: "잘못된 위치",
    },
  ];

  const selected = selectValidFindings(findings, collectCommentableLines(files), 1);

  assert.equal(selected.length, 1);
  assert.equal(selected[0].severity, "REQUIRED");
});

test("buildDiffBundle reports files omitted by the character budget", () => {
  const result = buildDiffBundle(files, 20);

  assert.equal(result.includedFiles, 0);
  assert.equal(result.omittedFiles, 1);
});
