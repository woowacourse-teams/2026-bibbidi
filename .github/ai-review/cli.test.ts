import assert from "node:assert/strict";
import test from "node:test";
import { validateEnvironment } from "./cli.ts";

const validEnvironment = {
  GITHUB_TOKEN: "github-token",
  OPENAI_API_KEY: "openai-key",
  REVIEW_REPOSITORY: "owner/repository",
  REVIEW_PULL_NUMBER: "222",
  REVIEW_HEAD_SHA: "abc123",
};

test("필수 환경변수를 검증한다", () => {
  assert.throws(
    () => validateEnvironment({ ...validEnvironment, OPENAI_API_KEY: "" }),
    /OPENAI_API_KEY/,
  );
});

test("PR 번호는 1 이상의 정수여야 한다", () => {
  assert.throws(
    () => validateEnvironment({ ...validEnvironment, REVIEW_PULL_NUMBER: "NaN" }),
    /1 이상의 정수/,
  );
  assert.equal(validateEnvironment(validEnvironment).REVIEW_PULL_NUMBER, "222");
});
