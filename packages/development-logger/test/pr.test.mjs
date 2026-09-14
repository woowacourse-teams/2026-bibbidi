import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { removeDirectory, temporaryDirectory } from '../src/git.mjs';
import { assertTemplateStructure, buildPullRequestBody, updatePullRequestInput } from '../src/pr.mjs';

test('기존 PR body 옵션을 Template 기반 body file로 교체한다', () => {
  const input = { command: 'gh pr create --fill --body "old" --base release-be' };
  const updated = updatePullRequestInput(input, 'C:\\repo\\.git\\development-logger\\pr.md', 'type: chore');
  assert.doesNotMatch(updated.command, /--fill\b/);
  assert.doesNotMatch(updated.command, /\bold\b/);
  assert.match(updated.command, /--body-file/);
  assert.match(updated.command, /pr\.md/);
  assert.match(updated.command, /--label "type: chore"/);
});

test('PR 명령의 기존 Type Label이 Branch Prefix와 다르면 차단한다', () => {
  const input = { command: 'gh pr create --label "type: feature"' };
  assert.throws(() => updatePullRequestInput(input, 'pr.md', 'type: chore'), /일치하지 않습니다/);
});

test('Repository PR Template의 Section 누락을 차단한다', () => {
  const template = '## 관련 Issue\n\n## 검증 결과\n';
  assert.doesNotThrow(() => assertTemplateStructure(template, `${template}\n- 완료`));
  assert.throws(() => assertTemplateStructure(template, '## 관련 Issue\n- #106'), /검증 결과/);
});

test('PR 본문은 Issue 중복을 제거하고 AI 리뷰와 같은 심각도를 사용한다', () => {
  const root = temporaryDirectory();
  try {
    const eventDirectory = join(root, '.devlog', '106');
    mkdirSync(eventDirectory, { recursive: true });
    writeFileSync(join(eventDirectory, 'events.jsonl'), [
      JSON.stringify({ type: 'TURN_FINISHED', assistantMessage: 'Label Gate 구현을 완료했다.' }),
      JSON.stringify({ type: 'ADR_CHANGED', decision: 'Type Label만 강제한다.' }),
    ].join('\n'));
    const body = buildPullRequestBody({
      root,
      config: {},
      state: { issue: 106 },
      files: ['.codex/hooks.json', '.github/pull_request_template.md', 'package.json'],
      validations: [{ command: 'node --test test/index.test.mjs', passed: true }],
      issueData: { title: 'Label Gate' },
    });
    const repositoryRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
    const template = readFileSync(join(repositoryRoot, '.github', 'pull_request_template.md'), 'utf8');
    assert.doesNotThrow(() => assertTemplateStructure(template, body));
    assert.match(body, /\[REQUIRED\]/);
    assert.match(body, /\[CAUTION\]/);
    assert.match(body, /\[ADVICE\]/);
    assert.doesNotMatch(body, /## Edge Case|## 검토한 대안|## 주요 사용자-Agent 대화/);
  } finally {
    removeDirectory(root);
  }
});
