import assert from 'node:assert/strict';
import test from 'node:test';
import { extractIssueNumber, hasInitialAdr, hasIssueContent } from '../src/issue.ts';
import { redact } from '../src/redaction.ts';

test('GitHub URL과 일반 표기에서 Issue ID를 추출한다', () => {
  assert.equal(extractIssueNumber('https://github.com/org/repo/issues/106'), 106);
  assert.equal(extractIssueNumber('Issue 42 구현해줘'), 42);
  assert.equal(extractIssueNumber('#7 작업 시작'), 7);
  assert.equal(extractIssueNumber('99번 이슈 개발하자'), 99);
  assert.equal(extractIssueNumber('이슈 99번 이어서 하자'), 99);
  assert.equal(extractIssueNumber('번호가 없다'), null);
});

test('템플릿 제목과 빈 항목만 있는 Issue 본문은 내용 없음으로 본다', () => {
  const template = '## 변경 유형\n\n- [ ] Feature (`type: feature`)\n\n## 해결하려는 문제\n\n<!-- 결론부터 -->\n\n-\n\n## 완료 조건\n\n- [ ]\n';
  assert.equal(hasIssueContent(template), false);
  assert.equal(hasIssueContent(`${template}\n## 검증 방법\n\n- node --test\n`), true);
  assert.equal(hasIssueContent(''), false);
  assert.equal(hasIssueContent('- [x] Chore (`type: chore`)'), false);
});

test('최초 ADR의 필수 절을 확인한다', () => {
  assert.equal(hasInitialAdr('## ADR\n### 결정\n- A\n### 이유\n- B\n### 근거\n- C\n### 검증\n- D'), true);
  assert.equal(hasInitialAdr('## ADR\n### 결정\n- A'), false);
});

test('명백한 비밀값을 마스킹하고 일반 문장은 보존한다', () => {
  const secret = redact('token=abc123456 Authorization: Bearer very-secret-token');
  assert.equal(secret.redacted, true);
  assert.equal(secret.value.includes('abc123456'), false);
  assert.equal(secret.value.includes('very-secret-token'), false);
  assert.match(secret.value, /\[REDACTED\]/);

  const plain = redact('0분 일정 테스트도 추가해줘.');
  assert.deepEqual(plain, { value: '0분 일정 테스트도 추가해줘.', redacted: false });
});
