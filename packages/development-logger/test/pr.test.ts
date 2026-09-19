import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { removeDirectory, temporaryDirectory } from '../src/git.ts';
import { assertPullRequestEvents, assertTemplateStructure, buildPullRequestBody, updatePullRequestInput } from '../src/pr.ts';
import type { EventType, LogEvent } from '../src/types.ts';

const repositoryRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)));

function bodyFor(events: LogEvent[], files: string[]): string {
  const root = temporaryDirectory();
  try {
    const eventDirectory = join(root, '.devlog', '106');
    mkdirSync(eventDirectory, { recursive: true });
    writeFileSync(join(eventDirectory, 'events.jsonl'), events.map((event) => JSON.stringify(event)).join('\n'));
    return buildPullRequestBody({
      root,
      config: {},
      state: { issue: 106 },
      files,
      validations: [{ command: 'node --test test/index.test.ts', passed: true }],
      issueData: { title: 'Label Gate' },
    });
  } finally {
    removeDirectory(root);
  }
}

test('기존 PR body 옵션을 Template 기반 body file로 교체한다', () => {
  const input = { command: 'gh pr create --fill --body "old" --base release-be' };
  const updated = updatePullRequestInput(input, 'C:\\repo\\.git\\development-logger\\pr.md', 'type: chore');
  assert.doesNotMatch(String(updated.command), /--fill\b/);
  assert.doesNotMatch(String(updated.command), /\bold\b/);
  assert.match(String(updated.command), /--body-file/);
  assert.match(String(updated.command), /pr\.md/);
  assert.match(String(updated.command), /--label "type: chore"/);
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

test('PR 본문은 에이전트 메시지 대신 결정과 변경 파일로 변경 사항을 만든다', () => {
  const body = bodyFor([
    { type: 'GRILL_ME_DECISION', decision: 'Type Label만 강제한다.' },
    { type: 'TURN_FINISHED', assistantMessage: '진행 상황을 설명하는 메시지' },
    { type: 'ADR_CHANGED', decision: 'PR 템플릿을 줄인다.' },
  ], ['.codex/hooks.json', '.github/pull_request_template.md', 'package.json']);
  const template = readFileSync(join(repositoryRoot, '.github', 'pull_request_template.md'), 'utf8');
  assert.doesNotThrow(() => assertTemplateStructure(template, body));
  assert.match(body, /- Type Label만 강제한다\./);
  assert.match(body, /변경한 파일: `\.codex\/hooks\.json`/);
  assert.doesNotMatch(body, /진행 상황을 설명하는 메시지/);
  assert.match(body, /\[REQUIRED\]/);
  assert.match(body, /\[CAUTION\]/);
  assert.match(body, /\[ADVICE\]/);
  assert.doesNotMatch(body, /## Edge Case|## 검토한 대안|## 주요 사용자-Agent 대화/);
});

test('PR 전에 개발자와 정한 요약과 리뷰 요청으로 본문을 만든다', () => {
  const body = bodyFor([
    { type: 'GRILL_ME_DECISION', decision: '설계 결정' },
    { type: 'PR_PLANNED', summary: ['커밋 전 확인 단계를 추가했다.'], review: ['[REQUIRED] 커밋을 막는 조건', 'MCP PR 차단 문구'] },
  ], ['.codex/hooks.json']);
  assert.match(body, /## 최종 변경 사항\n\n- 커밋 전 확인 단계를 추가했다\./);
  assert.doesNotMatch(body, /- 설계 결정/);
  assert.match(body, /- \[REQUIRED\] 커밋을 막는 조건/);
  assert.match(body, /- \[CAUTION\] MCP PR 차단 문구/);
  assert.doesNotMatch(body, /작업을 막거나 허용하는 규칙/);
});

test('PR 전 작업 기록은 ADR 생략과 PR 내용 합의 여부를 확인한다', () => {
  const base: LogEvent[] = (['SESSION_STARTED', 'ISSUE_BOUND', 'GRILL_ME_STARTED', 'GRILL_ME_QUESTION', 'GRILL_ME_ANSWER', 'GRILL_ME_DECISION', 'GRILL_ME_FINISHED', 'TURN_FINISHED'] as EventType[])
    .map((type) => ({ type }));
  assert.throws(() => assertPullRequestEvents([...base, { type: 'PR_PLANNED' }]), /ADR_CREATED/);
  assert.deepEqual(assertPullRequestEvents([...base, { type: 'ADR_SKIPPED' }, { type: 'PR_PLANNED' }]), { adrSkipped: true });
  assert.throws(() => assertPullRequestEvents([...base, { type: 'ADR_CREATED' }]), /PR에 올릴 내용/);
  assert.throws(() => assertPullRequestEvents([...base, { type: 'ADR_CREATED' }, { type: 'PR_PLANNED' }, { type: 'COMMIT_CONFIRMED' }]), /다시 정해/);
});
