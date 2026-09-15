import assert from 'node:assert/strict';
import test from 'node:test';
import { isGitCommit, isIssueCreate, isMutation, isPullRequestCreate, isPullRequestCreateByOtherTool } from '../src/tool-policy.mjs';
import { recordValidation, requiredValidations, responseSucceeded, validationForCommand } from '../src/validation.mjs';

const config = {
  validation: [
    { key: 'logger-test', paths: ['packages/development-logger/'], commands: ['node --test packages/development-logger/test/index.test.mjs'] },
    { key: 'be-test', paths: ['BE/'], commands: ['BE/gradlew test', 'BE/gradlew.bat test'] },
  ],
};

test('검증 명령과 변경 경로를 정규화한다', () => {
  assert.equal(validationForCommand(config, 'node --test packages\\development-logger\\test\\index.test.mjs').key, 'logger-test');
  assert.equal(validationForCommand(config, '.\\BE\\gradlew.bat test').key, 'be-test');
  assert.deepEqual(requiredValidations(config, ['BE/src/App.java']).map((item) => item.key), ['be-test']);
});

test('에이전트가 자주 쓰는 형태의 Gradle 테스트 명령을 같은 검증으로 인식한다', () => {
  for (const command of ['./BE/gradlew -p BE test', './BE/gradlew test -p BE', 'cd BE && ./gradlew test', 'BE/gradlew --project-dir=BE clean test --info']) {
    assert.equal(validationForCommand(config, command)?.key, 'be-test', command);
  }
  assert.equal(validationForCommand(config, 'cd /repo/BE && ./gradlew test', '/repo')?.key, 'be-test');
  assert.equal(validationForCommand(config, './BE/gradlew build -x test'), null);
  assert.equal(validationForCommand(config, './gradlew test'), null);
});

test('Tool 응답의 성공과 실패를 판정한다', () => {
  assert.equal(responseSucceeded({ exit_code: 0 }), true);
  assert.equal(responseSucceeded({ exitCode: 1 }), false);
  assert.equal(responseSucceeded('Process exited with code 2'), false);
  assert.equal(responseSucceeded({ success: false }), false);
});

test('결과를 기다리지 않은 테스트 실행은 검증 결과로 기록하지 않는다', () => {
  const state = {};
  const command = 'node --test packages/development-logger/test/index.test.mjs';
  assert.equal(recordValidation(state, config, { command, run_in_background: true }, { backgroundTaskId: 'task-1' }, null), false);
  assert.equal(recordValidation(state, config, { command: `${command} | tail -5` }, { exit_code: 0 }, null), false);
  assert.equal(recordValidation(state, config, { command: './BE/gradlew test &' }, { exit_code: 0 }, null), false);
  assert.deepEqual(state, {});
});

test('준비 전 조회와 검증은 허용하고 변경은 식별한다', () => {
  assert.equal(isMutation('Read', { file_path: 'README.md' }, config, 106), false);
  assert.equal(isMutation('Bash', { command: 'git status --short' }, config, 106), false);
  assert.equal(isMutation('Bash', { command: 'node --test packages/development-logger/test/index.test.mjs' }, config, 106), false);
  assert.equal(isMutation('Bash', { command: 'gh issue edit 106 --body-file body.md' }, config, 106), false);
  assert.equal(isMutation('apply_patch', {}, config, 106), true);
  assert.equal(isMutation('Bash', { command: 'git commit -m "chore: 변경"' }, config, 106), true);
  assert.equal(isPullRequestCreate('Bash', { command: 'gh pr create --base release-be' }), true);
  assert.equal(isIssueCreate('Bash', { command: 'gh issue create --label "type: feature"' }), true);
});

test('이어 쓴 명령 중 하나라도 파일을 바꾸면 변경으로 판단한다', () => {
  const mutations = [
    'cat > notes.md <<EOF\nnode --test packages/development-logger/test/index.test.mjs\nEOF',
    'git status && echo done > status.txt',
    'git diff | tee changes.diff',
    'grep -rl old src | xargs sed -i "" s/old/new/',
    'find . -name "*.tmp" -delete',
    'pnpm add lodash',
    'gh api repos/org/repo/issues/1/comments -f body=hello',
  ];
  for (const command of mutations) {
    assert.equal(isMutation('Bash', { command }, config, 106), true, command);
  }
});

test('읽기만 하는 명령은 이어 써도 허용한다', () => {
  const readOnly = [
    'cd /repo && gh pr view 112 --json title',
    'git -C /repo remote -v',
    'pwd; ls -la; git log --oneline -5',
    'grep -n "a > b" README.md 2>/dev/null',
    'gh api repos/org/repo/pulls/112 | jq .title',
    './BE/gradlew -p BE test 2>&1',
  ];
  for (const command of readOnly) {
    assert.equal(isMutation('Bash', { command }, config, 106), false, command);
  }
});

test('커밋 명령과 다른 도구의 PR 생성을 식별한다', () => {
  assert.equal(isGitCommit('Bash', { command: 'git add . && git commit -m "feat: 변경"' }), true);
  assert.equal(isGitCommit('Bash', { command: 'git log --grep commit' }), false);
  assert.equal(isPullRequestCreateByOtherTool('mcp__github__create_pull_request'), true);
  assert.equal(isPullRequestCreateByOtherTool('Bash'), false);
});
