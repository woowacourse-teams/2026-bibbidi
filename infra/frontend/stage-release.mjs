import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readReleaseVersion } from "./release-version.mjs";

const exportDir = "FE/out";
const [argument, ...extraArguments] = process.argv.slice(2);
if (
  extraArguments.length ||
  (argument?.startsWith("--") && argument !== "--production")
) {
  throw new Error(
    "Usage: node stage-release.mjs [manifest-path | --production]",
  );
}
const production = argument === "--production";
const stagedManifestFile = production ? undefined : argument;
const environment = production ? "production" : "development";
const releaseRoot = `s3://techcourse-project-2026/bibbidi/fe/${environment}/releases`;
const revalidate = "public,max-age=0,must-revalidate";
const immutable = "public,max-age=31536000,immutable";

async function listFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(join(directory, entry.name), path + "/")));
    } else if (entry.isFile()) {
      files.push(path);
    } else {
      throw new Error(`Unexpected file type in the export: ${path}`);
    }
  }
  return files;
}

async function describeFile(path) {
  let bytes = 0;
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(join(exportDir, path))) {
    bytes += chunk.length;
    hash.update(chunk);
  }
  return { path, bytes, sha256: hash.digest("hex") };
}

function upload(source, target, cacheControl, ...options) {
  const result = spawnSync(
    "aws",
    [
      "s3",
      "cp",
      source,
      target,
      "--only-show-errors",
      "--cache-control",
      cacheControl,
      ...options,
    ],
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`S3 upload failed: ${target}`);
}

const version = await readReleaseVersion({ production });

const paths = (await listFiles(exportDir)).sort();
for (const path of [
  "index.html",
  "404.html",
  "calendar/index.html",
  "calendar/index.txt",
]) {
  if (!paths.includes(path))
    throw new Error(`Missing static export file: ${path}`);
}
if (!paths.some((path) => path.startsWith("_next/static/"))) {
  throw new Error("Missing Next.js static assets.");
}
if (paths.some((path) => /\.map$/i.test(path))) {
  throw new Error("Source maps must not be uploaded to S3.");
}
if (paths.includes("version.json") || paths.includes("release-manifest.json")) {
  throw new Error("The export contains a reserved release metadata file.");
}

const releaseUri = `${releaseRoot}/${version.releaseId}`;
const files = [];
for (const path of paths) files.push(await describeFile(path));

const metadataDir = await mkdtemp(join(tmpdir(), "bibbidi-release-"));
try {
  const versionFile = join(metadataDir, "version.json");
  const manifestFile = join(metadataDir, "release-manifest.json");
  await writeFile(versionFile, JSON.stringify(version) + "\n");
  const manifest = JSON.stringify({ ...version, files }, null, 2) + "\n";
  await writeFile(manifestFile, manifest);

  upload(
    exportDir + "/",
    releaseUri + "/",
    immutable,
    "--recursive",
    "--exclude",
    "*",
    "--include",
    "_next/static/*",
  );
  upload(
    exportDir + "/",
    releaseUri + "/",
    revalidate,
    "--recursive",
    "--exclude",
    "_next/static/*",
  );
  upload(
    versionFile,
    releaseUri + "/version.json",
    revalidate,
    "--content-type",
    "application/json",
  );
  // Upload the manifest last. Its presence identifies a completed release.
  upload(
    manifestFile,
    releaseUri + "/release-manifest.json",
    revalidate,
    "--content-type",
    "application/json",
  );
  if (stagedManifestFile) {
    await writeFile(stagedManifestFile, manifest, {
      flag: "wx",
    });
  }
  console.log(
    `Staged ${version.version} (${paths.length} files) at ${releaseUri}/`,
  );
} finally {
  await rm(metadataDir, { recursive: true, force: true });
}
