export type MergedPullRequest = {
  baseBranch: string;
  headBranch: string;
  headSha: string;
  headRepository: string;
  labels: string[];
};

export type ImageDecision = {
  buildImage: boolean;
  imageTag: string;
};

type ImageDecisionInput = {
  releaseSha: string;
  repository: string;
  pullRequests: MergedPullRequest[];
  isDevelopmentCommit: (sha: string) => Promise<boolean>;
};

const RELEASE_BRANCH = "release-be";
const DEVELOPMENT_BRANCH = "dev-be";
const HOTFIX_BRANCH_PREFIX = "hotfix/";
const HOTFIX_LABEL = "type: hotfix";

export async function decideImage({
  releaseSha,
  repository,
  pullRequests,
  isDevelopmentCommit,
}: ImageDecisionInput): Promise<ImageDecision> {
  const releasePullRequests = pullRequests.filter((pullRequest) => pullRequest.baseBranch === RELEASE_BRANCH);

  const promotion = releasePullRequests.find(
    (pullRequest) => pullRequest.headBranch === DEVELOPMENT_BRANCH && pullRequest.headRepository === repository,
  );
  if (promotion) {
    if (!(await isDevelopmentCommit(promotion.headSha))) {
      throw new Error("승격 PR의 마지막 커밋이 dev-be에 없습니다. 운영 배포를 거부합니다.");
    }
    return { buildImage: false, imageTag: promotion.headSha };
  }

  const hotfix = releasePullRequests.find(
    (pullRequest) => pullRequest.headBranch.startsWith(HOTFIX_BRANCH_PREFIX) && pullRequest.labels.includes(HOTFIX_LABEL),
  );
  if (hotfix) return { buildImage: true, imageTag: releaseSha };

  throw new Error("release-be에 dev-be 승격 PR도 승인된 hotfix PR도 없는 커밋입니다.");
}
