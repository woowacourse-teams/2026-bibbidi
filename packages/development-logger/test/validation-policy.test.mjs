import assert from 'node:assert/strict';
import test from 'node:test';
import { isMutation, isPullRequestCreate } from '../src/tool-policy.mjs';
import { requiredValidations, responseSucceeded, validationForCommand } from '../src/validation.mjs';

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

test('Tool 응답의 성공과 실패를 판정한다', () => {
  assert.equal(responseSucceeded({ exit_code: 0 }), true);
  assert.equal(responseSucceeded({ exitCode: 1 }), false);
  assert.equal(responseSucceeded('Process exited with code 2'), false);
  assert.equal(responseSucceeded({ success: false }), false);
});

test('준비 전 조회와 검증은 허용하고 변경은 식별한다', () => {
  assert.equal(isMutation('Read', { file_path: 'README.md' }, config, 106), false);
  assert.equal(isMutation('Bash', { command: 'git status --short' }, config, 106), false);
  assert.equal(isMutation('Bash', { command: 'node --test packages/development-logger/test/index.test.mjs' }, config, 106), false);
  assert.equal(isMutation('Bash', { command: 'gh issue edit 106 --body-file body.md' }, config, 106), false);
  assert.equal(isMutation('apply_patch', {}, config, 106), true);
  assert.equal(isMutation('Bash', { command: 'git commit -m "chore: 변경"' }, config, 106), true);
  assert.equal(isPullRequestCreate('Bash', { command: 'gh pr create --base release-be' }), true);
});
