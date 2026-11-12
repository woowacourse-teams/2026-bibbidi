import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const stage = fileURLToPath(new URL("./stage-release.mjs", import.meta.url));
const routing = readFileSync(
  new URL("./production-routing.js", import.meta.url),
  "utf8",
);

test("production only archives the export and records the stable version last", async (t) => {
  const cwd = mkdtempSync(join(tmpdir(), "bibbidi-test-production-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const bin = join(cwd, "bin");
  mkdirSync(bin);
  mkdirSync(join(cwd, "FE/out/calendar"), { recursive: true });
  mkdirSync(join(cwd, "FE/out/_next/static"), { recursive: true });
  for (const path of [
    "index.html",
    "404.html",
    "calendar/index.html",
    "calendar/index.txt",
    "_next/static/chunk.js",
  ]) {
    writeFileSync(join(cwd, "FE/out", path), path);
  }
  writeFileSync(join(cwd, "FE/package.json"), '{"version":"1.0.0"}');
  writeFileSync(join(cwd, "FE/CHANGELOG.md"), "## 1.0.0\n");
  writeFileSync(
    join(bin, "aws"),
    `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const metadata = args.includes("application/json")
  ? JSON.parse(fs.readFileSync(args[2], "utf8"))
  : null;
fs.appendFileSync("uploads.jsonl", JSON.stringify({args, metadata}) + "\\n");
`,
    { mode: 0o755 },
  );

  const commit = "a".repeat(40);
  const uuid = "12345678-1234-1234-1234-123456789012";
  const run = (project) =>
    spawnSync(process.execPath, [stage, "--production"], {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: [bin, process.env.PATH].join(":"),
        CODEBUILD_BUILD_ID: `${project}:${uuid}`,
        CODEBUILD_BUILD_NUMBER: "12",
        CODEBUILD_RESOLVED_SOURCE_VERSION: commit,
      },
    });

  assert.notEqual(run("bibbidi-fe-development-build").status, 0);
  assert.throws(() => readFileSync(join(cwd, "uploads.jsonl")), {
    code: "ENOENT",
  });

  const result = run("bibbidi-fe-production-build");
  assert.equal(result.status, 0, result.stderr);
  const uploads = readFileSync(join(cwd, "uploads.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map(JSON.parse);
  const uri = `s3://techcourse-project-2026/bibbidi/fe/production/releases/${commit}-${uuid}`;
  assert.deepEqual(
    uploads.map(({ args }) => args.slice(0, 2)),
    Array(4).fill(["s3", "cp"]),
  );
  assert.deepEqual(
    uploads.map(({ args }) => args[3]),
    [
      `${uri}/`,
      `${uri}/`,
      `${uri}/version.json`,
      `${uri}/release-manifest.json`,
    ],
  );
  const version = uploads[2].metadata;
  assert.equal(version.version, "1.0.0");
  assert.equal(version.commit, commit);
  assert.ok(version.changelogUrl.endsWith(`/${commit}/FE/CHANGELOG.md`));
  assert.equal(uploads[3].metadata.version, version.version);
  assert.equal(uploads[3].metadata.files.length, 5);
});

test("production routing rewrites static documents and preserves assets and query strings", () => {
  const handler = runInNewContext(routing + "\nhandler");
  for (const [method, uri, expected] of [
    ["GET", "/", "/index.html"],
    ["HEAD", "/auth/kakao", "/auth/kakao/index.html"],
    ["GET", "/preparation/", "/preparation/index.html"],
    ["GET", "/missing", "/missing/index.html"],
    ["GET", "/_next/static/chunk.js", "/_next/static/chunk.js"],
    ["GET", "/preparation/index.txt", "/preparation/index.txt"],
    ["GET", "/assets/old-chunk.js", "/assets/old-chunk.js"],
    ["GET", "/icon/vendor", "/icon/vendor"],
    ["GET", "/api/catalog", "/api/catalog"],
    ["POST", "/unknown", "/unknown"],
  ]) {
    const querystring = { categoryId: { value: "1" } };
    const result = handler({ request: { method, uri, querystring } });
    assert.equal(result.uri, expected);
    assert.equal(result.querystring, querystring);
  }
});
