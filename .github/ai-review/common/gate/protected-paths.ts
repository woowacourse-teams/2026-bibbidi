import type { PullRequestFile } from "../ai-review-types.ts";

const PROTECTED_PATH_PATTERNS = [
  /^\.github\/ai-review\//,
  /^\.github\/workflows\/ai-(?:code-)?review[^/]*\.ya?ml$/,
];

/** 리뷰 봇 자체를 바꾸는 파일. 자동 리뷰 대신 사람이 직접 확인한다. */
export class ProtectedPaths {
  touchedBy(files: PullRequestFile[]) {
    return files
      .map((file) => file.filename)
      .filter((path) => PROTECTED_PATH_PATTERNS.some((pattern) => pattern.test(path)));
  }
}
