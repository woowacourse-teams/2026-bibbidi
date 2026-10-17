import type { PullRequestFile } from "../ai-review-types.ts";

const EXCLUDED_PATH_PATTERNS = [
  // 락·생성 파일
  /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|gradle\.lockfile|[^/]+\.lock)$/,
  /(^|\/)(build|dist|out|node_modules|\.gradle)\//,
  // 에이전트·도구 설정
  /^\.(claude|agents|codex|codex-bin|tmp-bin|devlog)\//,
  /^\.devlogger\.json$/,
  // 문서
  /^docs\//,
  /\.md$/i,
  // 테스트 리소스·스냅샷
  /(^|\/)__snapshots__\//,
  /\.snap$/,
  /(^|\/)src\/test\/resources\//,
  // 이미지·바이너리
  /\.(png|jpe?g|gif|webp|ico|svg|pdf|zip|jar|woff2?|ttf|eot|mp4|mov)$/i,
];

export class ExcludedPaths {
  contains(path: string) {
    return EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(path));
  }

  reviewable(files: PullRequestFile[]) {
    return files.filter((file) => !this.contains(file.filename));
  }
}
