import { spawn, execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import nextEnv from "@next/env";
import { parseCatalogResponse } from "../src/features/catalog/data-source/catalogResponse.ts";

const [command, ...args] = process.argv.slice(2);
if (command !== "dev" && command !== "build") {
  throw new Error("Next.js dev 또는 build 명령이 필요합니다.");
}

const isDev = command === "dev";
nextEnv.loadEnvConfig(process.cwd(), isDev);

function catalogEndpoint() {
  const configuredOrigin =
    process.env.BIBBIDI_CATALOG_API_ORIGIN?.trim() ||
    (isDev &&
      (process.env.BIBBIDI_API_PROXY_TARGET ||
        process.env.BIBBIDI_API_BASE_URL ||
        "https://dev-api.bibbidi.kr"));
  if (!configuredOrigin) {
    throw new Error(
      "BIBBIDI_CATALOG_API_ORIGIN에 공개 API origin을 설정해 주세요.",
    );
  }
  const url = new URL(configuredOrigin);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "BIBBIDI_CATALOG_API_ORIGIN은 HTTP(S) origin이어야 합니다.",
    );
  }
  return new URL("/api/catalog", url);
}

async function loadCatalog() {
  const response = await fetch(catalogEndpoint(), {
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(
      `공개 카탈로그 조회에 실패했습니다 (HTTP ${response.status}).`,
    );
  }
  const catalog = parseCatalogResponse(await response.json());
  // Spring can return a structurally valid empty catalog. This export must contain a public list.
  if (!catalog.stepDetails.some(({ tasks }) => tasks.length > 0)) {
    throw new Error("공개 카탈로그에 게시할 준비 항목이 없습니다.");
  }
  return catalog;
}

function sourceCommit() {
  return (
    process.env.CODEBUILD_RESOLVED_SOURCE_VERSION ||
    process.env.GITHUB_SHA ||
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  );
}

const catalog = await loadCatalog();
const payload = JSON.stringify(catalog);
const snapshot = {
  buildId: randomUUID(),
  sourceCommit: sourceCommit(),
  catalogHash: createHash("sha256").update(payload).digest("hex"),
  fetchedAt: new Date().toISOString(),
  catalog,
};

const snapshotDirectory = await mkdtemp(join(tmpdir(), "bibbidi-catalog-"));
try {
  const snapshotPath = join(snapshotDirectory, "snapshot.json");
  await writeFile(snapshotPath, JSON.stringify(snapshot));
  const require = createRequire(import.meta.url);
  const child = spawn(
    process.execPath,
    [require.resolve("next/dist/bin/next"), command, ...args],
    {
      env: {
        ...process.env,
        BIBBIDI_CATALOG_SNAPSHOT_PATH: snapshotPath,
        BIBBIDI_BUILD_ID: snapshot.buildId,
      },
      stdio: "inherit",
    },
  );
  const forwardInterrupt = () => child.kill("SIGINT");
  const forwardTermination = () => child.kill("SIGTERM");
  process.once("SIGINT", forwardInterrupt);
  process.once("SIGTERM", forwardTermination);
  try {
    const [code, signal] = await once(child, "exit");
    process.exitCode = code ?? (signal === "SIGINT" ? 130 : 143);
    if (code === 0 && !isDev) {
      await writeFile(".next/catalog-snapshot.json", JSON.stringify(snapshot));
    }
  } finally {
    process.off("SIGINT", forwardInterrupt);
    process.off("SIGTERM", forwardTermination);
  }
} finally {
  await rm(snapshotDirectory, { recursive: true, force: true });
}
