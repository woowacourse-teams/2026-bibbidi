import type { PullRequestFile, ScanTarget } from "../ai-review-types.ts";

/** patch에서 새로 추가된 줄만 파일:줄 위치와 함께 꺼낸다. */
export class AddedLines {
  private readonly files: PullRequestFile[];

  constructor(files: PullRequestFile[]) {
    this.files = files;
  }

  targets() {
    const targets: ScanTarget[] = [];

    for (const file of this.files) {
      let newLine = 0;
      for (const line of file.patch?.split("\n") ?? []) {
        const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (hunk) {
          newLine = Number(hunk[1]);
        } else if (line.startsWith("+") && !line.startsWith("+++")) {
          targets.push({ location: `${file.filename}:${newLine}`, text: line.slice(1) });
          newLine += 1;
        } else if (line.startsWith(" ")) {
          newLine += 1;
        }
      }
    }

    return targets;
  }
}
