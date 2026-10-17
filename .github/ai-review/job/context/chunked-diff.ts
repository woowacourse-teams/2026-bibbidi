import type { PullRequestFile, ReviewChunk } from "../../common/ai-review-types.ts";

const MAX_DIFF_CHUNK_CHARACTERS = 45_000;

/** 파일과 hunk 단위로 나눈 전체 diff. */
export class ChunkedDiff {
  private readonly files: PullRequestFile[];
  private readonly maxCharacters: number;
  private cache: ReviewChunk[] | undefined;

  constructor(files: PullRequestFile[], maxCharacters = MAX_DIFF_CHUNK_CHARACTERS) {
    this.files = files;
    this.maxCharacters = maxCharacters;
  }

  chunks() {
    this.cache ??= this.split();
    return this.cache;
  }

  unavailablePatches() {
    return this.files.filter((file) => !file.patch).length;
  }

  private split() {
    const chunks: ReviewChunk[] = [];
    let text = "";
    let chunkFiles = new Map<string, PullRequestFile>();

    const flush = () => {
      if (!text) return;
      chunks.push({ text, files: [...chunkFiles.values()] });
      text = "";
      chunkFiles = new Map();
    };

    for (const file of this.files) {
      for (const unit of this.unitsOf(file)) {
        if (text && text.length + unit.length > this.maxCharacters) flush();
        text += `${unit}\n`;
        chunkFiles.set(file.filename, file);
        if (text.length >= this.maxCharacters) flush();
      }
    }
    flush();

    return chunks;
  }

  private header(file: PullRequestFile) {
    return [
      `FILE: ${file.filename}`,
      file.previous_filename ? `PREVIOUS_FILE: ${file.previous_filename}` : "",
      `STATUS: ${file.status}`,
      `CHANGES: +${file.additions} -${file.deletions}`,
    ].filter(Boolean).join("\n");
  }

  private unitsOf(file: PullRequestFile) {
    if (!file.patch) {
      return [`${this.header(file)}\n[patch unavailable: binary or GitHub API limit]\n`];
    }

    const hunks: string[][] = [];
    let current: string[] = [];
    for (const line of file.patch.split("\n")) {
      if (line.startsWith("@@") && current.length > 0) {
        hunks.push(current);
        current = [];
      }
      current.push(line);
    }
    if (current.length > 0) hunks.push(current);

    return hunks.map((hunk, index) => [
      this.header(file),
      `HUNK: ${index + 1}/${hunks.length}`,
      hunk.join("\n"),
      "",
    ].join("\n"));
  }
}
