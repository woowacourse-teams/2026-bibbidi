import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { readEvents } from '../src/events.mjs';
import { handleHook } from '../src/hook.mjs';
import { runLifecycle } from '../src/lifecycle.mjs';
import { removeDirectory, temporaryDirectory } from '../src/git.mjs';
import { run } from '../src/process.mjs';

function setupRepository() {
  const root = temporaryDirectory();
  run('git', ['init', '-b', 'release-be'], { cwd: root });
  run('git', ['config', 'user.name', 'Dev Logger Test'], { cwd: root });
  run('git', ['config', 'user.email', 'devlogger@example.com'], { cwd: root });
  writeFileSync(join(root, '.devlogger.json'), JSON.stringify({
    version: 1,
    repository: 'example/repo',
    defaultBaseBranch: 'release-be',
    validation: [],
  }));
  writeFileSync(join(root, 'tracked.txt'), 'before\n');
  run('git', ['add', '.'], { cwd: root });
  run('git', ['commit', '-m', 'initial'], { cwd: root });
  return root;
}

test('Issue binding부터 grill-me, ADR Gate, Turn Diff까지 연결한다', () => {
  const root = setupRepository();
  const session = 'integration-session';
  const issue = {
    number: 106,
    title: 'AX 설정',
    body: '## ADR\n### 결정\n- Node core\n### 이유\n- 공통 처리\n### 근거\n- 공식 schema\n### 검증\n- node test',
    state: 'OPEN',
    comments: [],
    url: 'https://example.test/issues/106',
  };
  const options = { agent: 'codex', cwd: root, services: { getIssue: () => issue } };
  try {
    handleHook({
      ...options,
      payload: { hook_event_name: 'SessionStart', session_id: session, cwd: root, source: 'startup' },
    });
    handleHook({
      ...options,
      payload: { hook_event_name: 'UserPromptSubmit', session_id: session, cwd: root, turn_id: '1', prompt: 'Issue 106 시작해줘' },
    });
    runLifecycle(['grill', 'start', '--session', session], root);
    runLifecycle(['grill', 'question', '--session', session, '--text', '공통 core를 사용할 것인가?'], root);
    handleHook({
      ...options,
      payload: { hook_event_name: 'UserPromptSubmit', session_id: session, cwd: root, turn_id: '2', prompt: '공통 core로 해줘' },
    });
    runLifecycle(['grill', 'decision', '--session', session, '--text', '공통 core를 사용한다.'], root);
    runLifecycle(['grill', 'finish', '--session', session], root);

    const gate = handleHook({
      ...options,
      payload: { hook_event_name: 'PreToolUse', session_id: session, cwd: root, tool_name: 'apply_patch', tool_input: {} },
    });
    assert.equal(gate.hookSpecificOutput.permissionDecision, 'allow');

    writeFileSync(join(root, 'tracked.txt'), 'after\n');
    handleHook({
      ...options,
      payload: { hook_event_name: 'Stop', session_id: session, cwd: root, turn_id: '2', last_assistant_message: '구현 완료' },
    });

    const events = readEvents(root, 106);
    for (const type of ['SESSION_STARTED', 'ISSUE_BOUND', 'GRILL_ME_STARTED', 'GRILL_ME_QUESTION', 'GRILL_ME_ANSWER', 'GRILL_ME_DECISION', 'GRILL_ME_FINISHED', 'ADR_CREATED', 'TURN_FINISHED']) {
      assert.equal(events.some((event) => event.type === type), true, type);
    }
    const diff = readFileSync(join(root, '.devlog', '106', 'turn-001.diff'), 'utf8');
    assert.match(diff, /tracked\.txt/);
    assert.doesNotMatch(diff, /\.devlog/);
  } finally {
    removeDirectory(root);
  }
});

test('ADR 재개 후 grill-me는 새로운 설계 인터뷰 경계를 기록한다', () => {
  const root = setupRepository();
  const session = 'reopened-grill-session';
  const issue = {
    number: 106,
    title: 'AX 설정',
    body: '## ADR\n### 결정\n- 공통 core\n### 이유\n- 공통 처리\n### 근거\n- Issue 합의\n### 검증\n- node test',
    state: 'OPEN',
    comments: [],
    url: 'https://example.test/issues/106',
  };
  const options = { agent: 'codex', cwd: root, services: { getIssue: () => issue } };
  try {
    handleHook({
      ...options,
      payload: { hook_event_name: 'SessionStart', session_id: session, cwd: root, source: 'startup' },
    });
    handleHook({
      ...options,
      payload: { hook_event_name: 'UserPromptSubmit', session_id: session, cwd: root, turn_id: '1', prompt: 'Issue 106 시작해줘' },
    });

    for (const text of ['첫 설계', '변경 설계']) {
      runLifecycle(['grill', 'start', '--session', session], root);
      runLifecycle(['grill', 'question', '--session', session, '--text', `${text} 질문`], root);
      handleHook({
        ...options,
        payload: { hook_event_name: 'UserPromptSubmit', session_id: session, cwd: root, turn_id: text, prompt: `${text} 답변` },
      });
      runLifecycle(['grill', 'decision', '--session', session, '--text', `${text} 결정`], root);
      runLifecycle(['grill', 'finish', '--session', session], root);
      if (text === '첫 설계') runLifecycle(['adr', 'reopen', '--session', session, '--text', '핵심 결정 변경'], root);
    }

    const events = readEvents(root, 106);
    assert.equal(events.filter((event) => event.type === 'GRILL_ME_STARTED').length, 2);
    assert.equal(events.filter((event) => event.type === 'GRILL_ME_FINISHED').length, 2);
  } finally {
    removeDirectory(root);
  }
});
