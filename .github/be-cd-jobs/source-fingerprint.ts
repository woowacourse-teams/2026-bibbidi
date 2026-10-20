import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const CI_WORKFLOW_PATH = ".github/workflows/bibbidi-dev-ci.yml";

/** JAR를 만드는 소스(BE 디렉터리와 CI 워크플로)가 같은지 비교하는 해시. 병합 뒤 커밋 SHA가 달라져도 내용이 같으면 같은 값이다. */
export class SourceFingerprint {
  private readonly ref: string;

  constructor(ref = "HEAD") {
    this.ref = ref;
  }

  async value() {
    const backendTree = await this.objectId("BE");
    const workflowBlob = await this.objectId(CI_WORKFLOW_PATH);
    return createHash("sha256").update(`${backendTree}\n${workflowBlob}\n`).digest("hex").slice(0, 40);
  }

  private async objectId(path: string) {
    const { stdout } = await execFileAsync("git", ["rev-parse", `${this.ref}:${path}`]);
    return stdout.trim();
  }
}
