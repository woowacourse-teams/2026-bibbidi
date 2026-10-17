import { readFile } from "node:fs/promises";
import type { PullRequestFile } from "../review/ai-review-types.ts";

const COMMON_CONVENTION_FILE = "docs/convention/git-convention.md";
const BE_CONVENTION_FILES = [
  "docs/convention/code-convention.md",
  "docs/convention/error-handling.md",
  "docs/convention/test-strategy.md",
];

/** 변경 경로에 해당하는 저장소 규칙 문서와 경로별 검토 기준. */
export class ConventionDocuments {
  private readonly files: PullRequestFile[];

  constructor(files: PullRequestFile[]) {
    this.files = files;
  }

  async text() {
    const paths = [COMMON_CONVENTION_FILE];
    if (this.files.some((file) => file.filename.startsWith("BE/"))) paths.push(...BE_CONVENTION_FILES);

    const documents = await Promise.all(
      paths.map(async (path) => `# ${path}\n${await readFile(path, "utf8")}`),
    );
    return `${documents.join("\n\n")}\n\n# 변경 경로별 검토 기준\n${this.scopeGuidance()}`;
  }

  private scopeGuidance() {
    const paths = this.files.map((file) => file.filename);
    const guidance: string[] = [];

    if (paths.some((path) => path.startsWith(".github/workflows/") || path.startsWith(".github/ai-review/"))) {
      guidance.push("GitHub Actions: 최소 권한, secret 노출, pull_request_target의 신뢰 경계, 표현식 주입, action 버전, 실패 은폐를 확인한다.");
    }
    if (paths.some((path) => path.startsWith("Infra/"))) {
      guidance.push("인프라: 멱등성, 최소 권한, 비밀정보, 롤백, 부분 실패, 재실행과 장애 복구를 확인한다.");
    }
    if (paths.some((path) => path.startsWith("FE/"))) {
      guidance.push("프론트엔드: 상태 전이, 비동기 경쟁 조건, 접근성, API 계약, 오류·로딩·빈 상태를 확인한다.");
    }
    if (paths.some((path) => path.startsWith("APP/"))) {
      guidance.push("앱: 생명주기, 네트워크 실패, 플랫폼 권한, 백그라운드 전환과 API 계약을 확인한다.");
    }

    return guidance.join("\n") || "기존 코드와 설정에서 확인되는 저장소 패턴을 기준으로 검토한다.";
  }
}
