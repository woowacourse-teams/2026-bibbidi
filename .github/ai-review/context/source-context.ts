import type { PullRequest, PullRequestFile, RepositoryTreeItem } from "../review/ai-review-types.ts";
import type { GitHubApi } from "../github/github-api.ts";

const MAX_CONTEXT_CHARACTERS = 80_000;
const EXCERPT_RADIUS = 25;

/** 변경 파일 주변 코드와 이름으로 연결되는 관련 테스트. */
export class SourceContext {
  private readonly github: GitHubApi;
  private readonly pullRequest: PullRequest;
  private readonly tree: RepositoryTreeItem[];

  constructor(github: GitHubApi, pullRequest: PullRequest, tree: RepositoryTreeItem[]) {
    this.github = github;
    this.pullRequest = pullRequest;
    this.tree = tree;
  }

  async load(files: PullRequestFile[]) {
    const sections: string[] = [];
    const includedRelated = new Set<string>();
    let used = 0;
    const append = (section: string) => {
      if (used >= MAX_CONTEXT_CHARACTERS) return;
      const remaining = MAX_CONTEXT_CHARACTERS - used;
      const value = section.length > remaining ? `${section.slice(0, remaining)}\n[context truncated]` : section;
      sections.push(value);
      used += value.length;
    };

    for (const file of files) {
      const ref = file.status === "removed" ? this.pullRequest.base.sha : this.pullRequest.head.sha;
      const sourcePath = file.status === "removed" ? file.previous_filename ?? file.filename : file.filename;
      if (!ref) continue;
      const content = await this.github.getRepositoryFile(sourcePath, ref);
      if (content !== undefined) {
        append(`<changed_file_context path="${sourcePath}">\n${this.excerpt(content, this.changedRightLines(file.patch))}\n</changed_file_context>`);
      }

      for (const relatedPath of this.relatedTestPaths(file)) {
        if (includedRelated.has(relatedPath) || !this.pullRequest.head.sha) continue;
        includedRelated.add(relatedPath);
        const relatedContent = await this.github.getRepositoryFile(relatedPath, this.pullRequest.head.sha);
        if (relatedContent !== undefined) {
          append(`<related_test path="${relatedPath}">\n${relatedContent}\n</related_test>`);
        }
      }
    }

    return sections.join("\n\n") || "조회 가능한 변경 파일 주변 코드나 관련 테스트가 없다.";
  }

  private changedRightLines(patch: string | undefined) {
    const lines: number[] = [];
    let newLine = 0;
    for (const line of patch?.split("\n") ?? []) {
      const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunk) {
        newLine = Number(hunk[1]);
      } else if (line.startsWith("+") && !line.startsWith("+++")) {
        lines.push(newLine++);
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        // 삭제된 줄은 오른쪽 줄 번호를 늘리지 않는다.
      } else if (line.startsWith(" ")) {
        newLine += 1;
      }
    }
    return lines;
  }

  private excerpt(content: string, targets: number[]) {
    const source = content.split("\n");
    if (targets.length === 0 || source.length <= EXCERPT_RADIUS * 4) return content;

    const ranges = targets
      .map((line) => ({ start: Math.max(1, line - EXCERPT_RADIUS), end: Math.min(source.length, line + EXCERPT_RADIUS) }))
      .sort((left, right) => left.start - right.start)
      .reduce<Array<{ start: number; end: number }>>((merged, range) => {
        const previous = merged.at(-1);
        if (previous && range.start <= previous.end + 1) previous.end = Math.max(previous.end, range.end);
        else merged.push({ ...range });
        return merged;
      }, []);

    return ranges.map((range) => [
      `LINES ${range.start}-${range.end}`,
      ...source.slice(range.start - 1, range.end).map((line, index) => `${range.start + index}: ${line}`),
    ].join("\n")).join("\n...\n");
  }

  private relatedTestPaths(file: PullRequestFile) {
    const filename = file.filename.split("/").at(-1) ?? "";
    const stem = filename.replace(/\.(java|kt|ts|tsx|js|jsx)$/, "");
    if (!stem || stem === filename) return [];

    const patterns = [
      `${stem}Test.java`, `${stem}Test.kt`, `${stem}.test.ts`, `${stem}.test.tsx`,
      `${stem}.spec.ts`, `${stem}.spec.tsx`,
    ];
    return this.tree
      .filter((item) => item.type === "blob" && item.path !== file.filename)
      .map((item) => item.path)
      .filter((path) => patterns.some((pattern) => path.endsWith(pattern)))
      .slice(0, 4);
  }
}
