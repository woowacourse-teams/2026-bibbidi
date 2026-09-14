import assert from 'node:assert/strict';
import test from 'node:test';
import { expectedTypeLabel, issueTypeLabel, validateIssueCreateInput } from '../src/type-label.mjs';

const config = {
  typeLabels: {
    feature: 'type: feature',
    fix: 'type: fix',
    hotfix: 'type: hotfix',
    chore: 'type: chore',
    docs: 'type: docs',
  },
};

test('Issue 생성 명령은 Type Label을 정확히 하나 요구한다', () => {
  assert.equal(validateIssueCreateInput({ command: 'gh issue create --label "type: feature"' }, config), 'type: feature');
  assert.throws(() => validateIssueCreateInput({ command: 'gh issue create' }, config), /정확히 하나/);
  assert.throws(() => validateIssueCreateInput({ command: 'gh issue create -l "type: feature,type: docs"' }, config), /정확히 하나/);
  assert.throws(() => validateIssueCreateInput({ command: 'gh issue create -l "type: unknown"' }, config), /지원하지 않는/);
});

test('Branch Prefix와 Issue Type Label의 일치를 검증한다', () => {
  assert.equal(expectedTypeLabel('chore/106', config), 'type: chore');
  assert.equal(issueTypeLabel({ labels: [{ name: 'type: chore' }] }, config, 'type: chore'), 'type: chore');
  assert.throws(() => issueTypeLabel({ labels: [{ name: 'type: feature' }] }, config, 'type: chore'), /일치하지 않습니다/);
  assert.throws(() => expectedTypeLabel('unknown/106', config), /결정할 수 없습니다/);
});
