import assert from "node:assert/strict";
import test from "node:test";
import { decideImage, type MergedPullRequest } from "./image-decision.ts";

const repository = "owner/repository";
const releaseSha = "release-sha";

const promotion: MergedPullRequest = {
  baseBranch: "release-be",
  headBranch: "dev-be",
  headSha: "dev-tip-sha",
  headRepository: repository,
  labels: [],
};

const hotfix: MergedPullRequest = {
  baseBranch: "release-be",
  headBranch: "hotfix/301",
  headSha: "hotfix-sha",
  headRepository: repository,
  labels: ["type: hotfix"],
};

const decide = (pullRequests: MergedPullRequest[], isDevelopmentCommit = true) =>
  decideImage({
    releaseSha,
    repository,
    pullRequests,
    isDevelopmentCommit: async () => isDevelopmentCommit,
  });

test("dev-be 승격 PR은 PR의 마지막 커밋 이미지를 재사용한다", async () => {
  assert.deepEqual(await decide([promotion]), { buildImage: false, imageTag: "dev-tip-sha" });
});

test("승격 PR의 마지막 커밋이 dev-be에 없으면 거부한다", async () => {
  await assert.rejects(() => decide([promotion], false), /dev-be에 없습니다/);
});

test("다른 저장소의 dev-be 브랜치는 승격으로 보지 않는다", async () => {
  await assert.rejects(
    () => decide([{ ...promotion, headRepository: "fork/repository" }]),
    /승격 PR도 승인된 hotfix PR도 없는/,
  );
});

test("승인된 hotfix PR은 release-be 커밋으로 이미지를 새로 빌드한다", async () => {
  assert.deepEqual(await decide([hotfix]), { buildImage: true, imageTag: releaseSha });
});

test("hotfix 라벨이 없으면 거부한다", async () => {
  await assert.rejects(() => decide([{ ...hotfix, labels: [] }]), /승격 PR도 승인된 hotfix PR도 없는/);
});

test("release-be 대상이 아닌 PR만 연결되어 있으면 거부한다", async () => {
  await assert.rejects(() => decide([{ ...promotion, baseBranch: "main" }]), /승격 PR도 승인된 hotfix PR도 없는/);
});

test("연결된 PR이 없으면 거부한다", async () => {
  await assert.rejects(() => decide([]), /승격 PR도 승인된 hotfix PR도 없는/);
});
