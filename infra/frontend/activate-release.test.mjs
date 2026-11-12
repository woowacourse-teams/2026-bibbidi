import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scripts = dirname(fileURLToPath(import.meta.url));
const commit = "a".repeat(40);
const uuid = "12345678-1234-1234-1234-123456789abc";
const releaseId = commit + "-" + uuid;
const previousRelease = "b".repeat(40) + "-" + uuid;
const contents = {
  "index.html": "<h1>Public catalog</h1>",
  "404.html": "<h1>Not found</h1>",
  "calendar/index.html": "<h1>Calendar</h1>",
  "calendar/index.txt": '1:"/_next/static/example.js"\n',
  "_next/static/example.js": "console.log('fixture');",
};

function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), "bibbidi-fixed-deploy-"));
  const manifestFile = join(directory, "release-manifest.json");
  const log = join(directory, "calls.jsonl");
  const manifest = {
    releaseId,
    commit,
    buildId: "bibbidi-fe-development-build:" + uuid,
    files: Object.entries(contents).map(([path, text]) => ({
      path,
      bytes: Buffer.byteLength(text),
      sha256: createHash("sha256").update(text).digest("hex"),
    })),
  };
  for (const [path, text] of Object.entries(contents)) {
    const file = join(directory, "FE/out", path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  writeFileSync(manifestFile, JSON.stringify(manifest));
  writeFileSync(
    join(directory, "aws"),
    `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const copiedMetadata = args.find(arg => /^\\/(?!\\/).*\\.json$/.test(arg));
const entry = { args };
if (copiedMetadata) entry.metadata = JSON.parse(fs.readFileSync(copiedMetadata, "utf8"));
fs.appendFileSync(process.env.MOCK_LOG, JSON.stringify(entry) + "\\n");
if (args.some(arg => /get-distribution|update-distribution|wait|get-invalidation/.test(arg))) process.exit(99);
if (process.env.MOCK_FAIL && args.includes(process.env.MOCK_FAIL)) process.exit(17);
if (args[0] === "cloudfront") console.log("I-FIXTURE");
`,
    { mode: 0o700 },
  );
  const preload = join(directory, "fetch.mjs");
  writeFileSync(
    preload,
    `import timers from "node:timers/promises";
import { syncBuiltinESMExports } from "node:module";
import { readFileSync, appendFileSync } from "node:fs";
const manifest = ${JSON.stringify(manifest)};
const contents = ${JSON.stringify(contents)};
let clock = 0, versionRequests = 0;
Date.now = () => clock;
timers.setTimeout = async milliseconds => { clock += milliseconds; };
syncBuiltinESMExports();
globalThis.fetch = async url => {
  appendFileSync(process.env.MOCK_LOG, JSON.stringify({ url }) + "\\n");
  const path = new URL(url).pathname;
  if (path === "/version.json") {
    const initial = versionRequests++ === 0;
    if (initial) return Response.json({releaseId: ${JSON.stringify(previousRelease)}});
    if (process.env.MOCK_SCENARIO === "transient" && versionRequests === 2) return new Response("retry", {status: 503});
    const actualId = process.env.MOCK_SCENARIO === "stale" ? ${JSON.stringify(previousRelease)} : manifest.releaseId;
    return Response.json({releaseId: actualId});
  }
  const type = path.endsWith(".txt") ? "text/plain" : "text/html";
  const wrong = process.env.MOCK_SCENARIO === "wrong-payload" || (process.env.MOCK_SCENARIO === "wrong-calendar" && path === "/calendar/index.txt");
  const content = wrong ? "stale" : contents[path.slice(1)];
  return new Response(content, {headers: {"content-type": type}});
};
`,
  );
  function execute(script = "activate-release.mjs", overrides = {}) {
    writeFileSync(log, "");
    const result = spawnSync(
      process.execPath,
      ["--import", preload, join(scripts, script), manifestFile],
      {
        cwd: directory,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: directory + ":" + process.env.PATH,
          S3_BUCKET_NAME: "techcourse-project-2026",
          S3_PREFIX: "bibbidi/fe/development",
          FE_SERVICE_URL: "https://dev.bibbidi.kr",
          CLOUDFRONT_DISTRIBUTION_ID: "E3TM3MDSJWPEW5",
          CODEBUILD_RESOLVED_SOURCE_VERSION: commit,
          CODEBUILD_BUILD_ID: manifest.buildId,
          MOCK_LOG: log,
          ...overrides,
        },
      },
    );
    assert.ifError(result.error);
    const calls = readFileSync(log, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    return { ...result, calls };
  }
  try {
    run({ execute, directory, manifestFile });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("publishes the complete export and polls public responses using existing permissions", () =>
  fixture(({ execute }) => {
    const result = execute();
    assert.equal(result.status, 0, result.stderr);
    const commands = result.calls.filter((call) => call.args);
    assert.deepEqual(
      commands.map(({ args }) => args.slice(0, 2)),
      [
        ["s3", "cp"],
        ["s3", "cp"],
        ["s3", "cp"],
        ["s3", "cp"],
        ["cloudfront", "create-invalidation"],
      ],
    );
    assert(commands[0].args.includes("_next/static/*"));
    assert(commands[0].args.includes("public,max-age=31536000,immutable"));
    assert(commands[1].args.includes("public,max-age=0,must-revalidate"));
    assert(!commands.some(({ args }) => args.includes("--delete")));
    assert(
      commands[2].args.includes(
        "s3://techcourse-project-2026/bibbidi/fe/development/release-manifest.json",
      ),
    );
    assert(
      commands[3].args.includes(
        "s3://techcourse-project-2026/bibbidi/fe/development/version.json",
      ),
    );
    assert.equal(commands[3].metadata.releaseId, releaseId);
    assert(commands[4].args.includes("E3TM3MDSJWPEW5"));
    assert(commands[4].args.includes("/*"));
    assert(
      result.calls.some((call) => call.url?.endsWith("/calendar/index.txt")),
    );
    assert(result.calls.some((call) => call.url?.endsWith("/index.html")));
    assert.match(result.stdout, /Verified development release/);
    assert(result.stdout.includes(previousRelease));
  }));

test("retries temporary CDN failures", () =>
  fixture(({ execute }) => {
    const result = execute("activate-release.mjs", {
      MOCK_SCENARIO: "transient",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Waiting for public release/);
  }));

test("fails on stale versions and payloads even when HTTP responses succeed", () => {
  for (const scenario of ["stale", "wrong-payload", "wrong-calendar"]) {
    fixture(({ execute }) => {
      const result = execute("activate-release.mjs", {
        MOCK_SCENARIO: scenario,
      });
      assert.notEqual(result.status, 0);
      assert(result.stderr.includes(previousRelease));
      assert.match(result.stdout, /Waiting for public release/);
      assert.doesNotMatch(result.stdout, /Verified development release/);
    });
  }
});

test("stops before publishing the version marker when export upload fails", () =>
  fixture(({ execute }) => {
    const result = execute("activate-release.mjs", { MOCK_FAIL: "FE/out/" });
    assert.notEqual(result.status, 0);
    assert.equal(result.calls.filter((call) => call.args).length, 1);
    assert(result.stderr.includes(previousRelease));
  }));

test("rejects production and mismatched build metadata before accessing AWS", () => {
  for (const overrides of [
    { CLOUDFRONT_DISTRIBUTION_ID: "EHMGV04SPRCWI" },
    { S3_PREFIX: "bibbidi/fe/production" },
    { FE_SERVICE_URL: "https://bibbidi.kr" },
    { CODEBUILD_RESOLVED_SOURCE_VERSION: "c".repeat(40) },
  ]) {
    fixture(({ execute }) => {
      const result = execute("activate-release.mjs", overrides);
      assert.notEqual(result.status, 0);
      assert.deepEqual(result.calls, []);
    });
  }
});

test("archive failure leaves no handoff manifest for publication", () =>
  fixture(({ execute, manifestFile }) => {
    rmSync(manifestFile);
    const result = execute("stage-release.mjs", {
      MOCK_FAIL: `s3://techcourse-project-2026/bibbidi/fe/development/releases/${releaseId}/release-manifest.json`,
    });
    assert.notEqual(result.status, 0);
    assert.equal(existsSync(manifestFile), false);
    assert.equal(result.calls.filter((call) => call.args).length, 4);
  }));
