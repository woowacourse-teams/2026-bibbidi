import assert from 'node:assert/strict';
import test from 'node:test';
import { assertTemplateStructure, updatePullRequestInput } from '../src/pr.mjs';

test('기존 PR body 옵션을 Template 기반 body file로 교체한다', () => {
  const input = { command: 'gh pr create --fill --body "old" --base release-be' };
  const updated = updatePullRequestInput(input, 'C:\\repo\\.git\\development-logger\\pr.md');
  assert.doesNotMatch(updated.command, /--fill\b/);
  assert.doesNotMatch(updated.command, /\bold\b/);
  assert.match(updated.command, /--body-file/);
  assert.match(updated.command, /pr\.md/);
});

test('Repository PR Template의 Section 누락을 차단한다', () => {
  const template = '## 관련 Issue\n\n## 검증 결과\n';
  assert.doesNotThrow(() => assertTemplateStructure(template, `${template}\n- 완료`));
  assert.throws(() => assertTemplateStructure(template, '## 관련 Issue\n- #106'), /검증 결과/);
});
