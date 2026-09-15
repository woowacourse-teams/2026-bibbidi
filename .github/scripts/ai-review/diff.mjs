import { MAX_DIFF_CHARACTERS, MAX_INLINE_COMMENTS } from "./config.mjs";

const SEVERITY_ORDER = new Map([
  ["REQUIRED", 0],
  ["CAUTION", 1],
  ["ADVICE", 2],
]);

export function collectCommentableLines(files) {
  const linesByFile = new Map();

  for (const file of files) {
    if (!file.patch) {
      continue;
    }

    const commentable = new Set();
    let oldLine = 0;
    let newLine = 0;

    for (const line of file.patch.split("\n")) {
      const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunk) {
        oldLine = Number(hunk[1]);
        newLine = Number(hunk[2]);
        continue;
      }

      if (line.startsWith("+") && !line.startsWith("+++")) {
        commentable.add(`RIGHT:${newLine}`);
        newLine += 1;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        commentable.add(`LEFT:${oldLine}`);
        oldLine += 1;
      } else if (line.startsWith(" ")) {
        commentable.add(`LEFT:${oldLine}`);
        commentable.add(`RIGHT:${newLine}`);
        oldLine += 1;
        newLine += 1;
      }
    }

    linesByFile.set(file.filename, commentable);
  }

  return linesByFile;
}

export function selectValidFindings(findings, linesByFile, limit = MAX_INLINE_COMMENTS) {
  const seen = new Set();

  return findings
    .filter((finding) => {
      if (!SEVERITY_ORDER.has(finding.severity)) {
        return false;
      }

      const commentable = linesByFile.get(finding.path);
      if (!commentable?.has(`${finding.side}:${finding.line}`)) {
        return false;
      }

      const key = [
        finding.path,
        finding.side,
        finding.line,
        finding.title.trim().toLowerCase(),
      ].join(":");
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort(
      (left, right) =>
        SEVERITY_ORDER.get(left.severity) - SEVERITY_ORDER.get(right.severity),
    )
    .slice(0, limit);
}

export function buildDiffBundle(files, maxCharacters = MAX_DIFF_CHARACTERS) {
  const sections = [];
  let usedCharacters = 0;
  let omittedFiles = 0;

  for (const file of files) {
    const header = [
      `FILE: ${file.filename}`,
      `STATUS: ${file.status}`,
      `CHANGES: +${file.additions} -${file.deletions}`,
    ].join("\n");
    const patch = file.patch ?? "[binary file or patch unavailable]";
    const section = `${header}\n${patch}\n`;

    if (usedCharacters + section.length > maxCharacters) {
      omittedFiles += 1;
      continue;
    }

    sections.push(section);
    usedCharacters += section.length;
  }

  return {
    text: sections.join("\n"),
    omittedFiles,
    includedFiles: sections.length,
  };
}
