import type { PullRequestFile } from "../../common/ai-review-types.ts";

/** diff에서 GitHub 인라인 댓글을 달 수 있는 파일별 양쪽 줄 번호. */
export class CommentableLines {
  private readonly files: PullRequestFile[];
  private cache: Map<string, Set<string>> | undefined;

  constructor(files: PullRequestFile[]) {
    this.files = files;
  }

  has(path: string, side: string, line: number) {
    return this.byFile().get(path)?.has(`${side}:${line}`) ?? false;
  }

  linesOf(path: string) {
    return this.byFile().get(path);
  }

  private byFile() {
    this.cache ??= this.collect();
    return this.cache;
  }

  private collect() {
    const linesByFile = new Map<string, Set<string>>();

    for (const file of this.files) {
      if (!file.patch) continue;

      const lines = new Set<string>();
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
          lines.add(`RIGHT:${newLine++}`);
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          lines.add(`LEFT:${oldLine++}`);
        } else if (line.startsWith(" ")) {
          lines.add(`LEFT:${oldLine++}`);
          lines.add(`RIGHT:${newLine++}`);
        }
      }

      linesByFile.set(file.filename, lines);
    }

    return linesByFile;
  }
}
