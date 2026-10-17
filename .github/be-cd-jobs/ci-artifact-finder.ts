import type { GitHubApi } from "../github/github-api.ts";

export const ARTIFACT_NAME_PREFIX = "app-jar-";

/** PR CI가 올린 JAR 중 같은 소스로 만든 것을 찾는다. 이 저장소가 아닌 곳(포크)에서 올린 것은 믿지 않는다. */
export class CiArtifactFinder {
  private readonly api: GitHubApi;

  constructor(api: GitHubApi) {
    this.api = api;
  }

  async findArtifactId(fingerprint: string) {
    const repositoryId = await this.api.getRepositoryId();
    const artifacts = await this.api.listArtifactsByName(`${ARTIFACT_NAME_PREFIX}${fingerprint}`);
    const trusted = artifacts.find(
      (artifact) => !artifact.expired && artifact.workflow_run?.head_repository_id === repositoryId,
    );
    return trusted?.id;
  }
}
