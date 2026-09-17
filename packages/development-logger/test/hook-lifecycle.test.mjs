import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

function issueWithoutAdr() {
  return {
    number: 106,
    title: 'AX 설정',
    body: '## 해결하려는 문제\n- 설정이 없다',
    state: 'OPEN',
    comments: [],
    url: 'https://example.test/issues/106',
  };
}

function prompt(options, session, turnId, text) {
  return handleHook({
    ...options,
    payload: { hook_event_name: 'UserPromptSubmit', session_id: session, cwd: options.cwd, turn_id: turnId, prompt: text },
  });
}

function preToolUse(options, session, toolName, toolInput) {
  return handleHook({
    ...options,
    payload: { hook_event_name: 'PreToolUse', session_id: session, cwd: options.cwd, tool_name: toolName, tool_input: toolInput },
  }).hookSpecificOutput;
}

function finishGrillWithoutAdr(options, session) {
  const root = options.cwd;
  prompt(options, session, '1', '106번 이슈 개발하자');
  runLifecycle(['grill', 'start', '--session', session], root);
  runLifecycle(['grill', 'question', '--session', session, '--text', '이번 작업에 ADR이 필요한가요?'], root);
  prompt(options, session, '2', '기술 선택이 없어서 필요 없어요');
  runLifecycle(['grill', 'decision', '--session', session, '--text', 'ADR 없이 진행한다.'], root);
  runLifecycle(['grill', 'finish', '--session', session], root);
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
    prompt(options, session, '1', 'Issue 106 시작해줘');
    runLifecycle(['grill', 'start', '--session', session], root);
    runLifecycle(['grill', 'question', '--session', session, '--text', '공통 core를 사용할 것인가?'], root);
    prompt(options, session, '2', '공통 core로 해줘');
    runLifecycle(['grill', 'decision', '--session', session, '--text', '공통 core를 사용한다.'], root);
    runLifecycle(['grill', 'finish', '--session', session], root);

    assert.equal(preToolUse(options, session, 'apply_patch', {}).permissionDecision, undefined);

    writeFileSync(join(root, 'tracked.txt'), 'after\n');
    handleHook({
      ...options,
      payload: { hook_event_name: 'Stop', session_id: session, cwd: root, turn_id: '2', last_assistant_message: '진행 상황 설명' },
    });

    const events = readEvents(root, 106);
    for (const type of ['SESSION_STARTED', 'ISSUE_BOUND', 'GRILL_ME_STARTED', 'GRILL_ME_QUESTION', 'GRILL_ME_ANSWER', 'GRILL_ME_DECISION', 'GRILL_ME_FINISHED', 'ADR_CREATED', 'TURN_FINISHED']) {
      assert.equal(events.some((event) => event.type === type), true, type);
    }
    const turn = events.find((event) => event.type === 'TURN_FINISHED');
    assert.equal(Object.hasOwn(turn, 'assistantMessage'), false);
    assert.doesNotMatch(readFileSync(join(root, '.devlog', '106', 'events.jsonl'), 'utf8'), /진행 상황 설명/);
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
    prompt(options, session, '1', 'Issue 106 시작해줘');

    for (const text of ['첫 설계', '변경 설계']) {
      runLifecycle(['grill', 'start', '--session', session], root);
      runLifecycle(['grill', 'question', '--session', session, '--text', `${text} 질문`], root);
      prompt(options, session, text, `${text} 답변`);
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

test('사용자가 ADR이 필요 없다고 답하면 Issue 본문 ADR 없이 구현을 허용한다', () => {
  const root = setupRepository();
  const session = 'adr-skip-session';
  const options = { agent: 'claude', cwd: root, services: { getIssue: () => issueWithoutAdr() } };
  try {
    finishGrillWithoutAdr(options, session);
    assert.equal(preToolUse(options, session, 'Edit', { file_path: 'tracked.txt' }).permissionDecision, 'deny');

    runLifecycle(['adr', 'skip', '--session', session, '--text', '기술 선택이 없는 작업이다.'], root);
    assert.equal(preToolUse(options, session, 'Edit', { file_path: 'tracked.txt' }).permissionDecision, 'allow');
    assert.equal(readEvents(root, 106).some((event) => event.type === 'ADR_CREATED'), false);
  } finally {
    removeDirectory(root);
  }
});

test('ADR 생략은 grill-me에서 받은 사용자 답이 있어야 기록한다', () => {
  const root = setupRepository();
  const session = 'adr-skip-without-answer-session';
  const options = { agent: 'claude', cwd: root, services: { getIssue: () => issueWithoutAdr() } };
  try {
    prompt(options, session, '1', '106번 이슈 개발하자');
    runLifecycle(['grill', 'start', '--session', session], root);
    assert.throws(() => runLifecycle(['adr', 'skip', '--session', session, '--text', '필요 없음'], root), /사용자 답이 없습니다/);
  } finally {
    removeDirectory(root);
  }
});

test('Issue가 연결되기 전 에이전트가 Issue를 조회하면 그 Issue로 연결한다', () => {
  const root = setupRepository();
  const session = 'issue-view-session';
  const options = { agent: 'claude', cwd: root, services: { getIssue: () => issueWithoutAdr() } };
  try {
    prompt(options, session, '1', '오늘 작업 시작하자');
    const output = preToolUse(options, session, 'Bash', { command: 'gh issue view 106 --json title,body' });
    assert.equal(output.permissionDecision, 'allow');
    assert.match(output.additionalContext, /Issue #106/);
    assert.equal(readEvents(root, 106).find((event) => event.type === 'ISSUE_BOUND').source, 'ISSUE_VIEW_COMMAND');
  } finally {
    removeDirectory(root);
  }
});

test('커밋은 개발자가 설명을 확인한 코드 상태에서만 허용한다', () => {
  const root = setupRepository();
  const session = 'commit-session';
  const options = { agent: 'claude', cwd: root, services: { getIssue: () => issueWithoutAdr() } };
  const commit = { command: 'git commit -am "chore: 변경"' };
  try {
    finishGrillWithoutAdr(options, session);
    runLifecycle(['adr', 'skip', '--session', session, '--text', '기술 선택이 없는 작업이다.'], root);
    writeFileSync(join(root, 'tracked.txt'), 'after\n');

    const denied = preToolUse(options, session, 'Bash', commit);
    assert.equal(denied.permissionDecision, 'deny');
    assert.match(denied.permissionDecisionReason, /설명하고 확인/);

    runLifecycle(['commit', 'explain', '--session', session, '--text', 'tracked.txt 내용을 after로 바꿨다.'], root);
    assert.throws(() => runLifecycle(['commit', 'confirm', '--session', session], root), /개발자 답이 없습니다/);
    prompt(options, session, '3', '좋아, 커밋해');
    runLifecycle(['commit', 'confirm', '--session', session], root);
    assert.equal(preToolUse(options, session, 'Bash', commit).permissionDecision, 'allow');

    writeFileSync(join(root, 'tracked.txt'), 'changed again\n');
    assert.equal(preToolUse(options, session, 'Bash', commit).permissionDecision, 'deny');
  } finally {
    removeDirectory(root);
  }
});

test('작업 기록 파일만 커밋할 때는 설명 확인을 요구하지 않는다', () => {
  const root = setupRepository();
  const session = 'devlog-commit-session';
  const options = { agent: 'claude', cwd: root, services: { getIssue: () => issueWithoutAdr() } };
  try {
    finishGrillWithoutAdr(options, session);
    runLifecycle(['adr', 'skip', '--session', session, '--text', '기술 선택이 없는 작업이다.'], root);
    mkdirSync(join(root, '.devlog', '106'), { recursive: true });
    const output = preToolUse(options, session, 'Bash', { command: 'git add .devlog && git commit -m "chore: 작업 기록"' });
    assert.equal(output.permissionDecision, 'allow');
  } finally {
    removeDirectory(root);
  }
});

test('GitHub MCP로 PR을 만들면 gh pr create를 쓰도록 막는다', () => {
  const root = setupRepository();
  const options = { agent: 'claude', cwd: root, services: { getIssue: () => issueWithoutAdr() } };
  try {
    const output = preToolUse(options, 'mcp-session', 'mcp__github__create_pull_request', { title: '새 PR' });
    assert.equal(output.permissionDecision, 'deny');
    assert.match(output.permissionDecisionReason, /gh pr create/);
  } finally {
    removeDirectory(root);
  }
});

test('Agent의 Issue 생성은 Type Label을 정확히 하나 요구한다', () => {
  const root = setupRepository();
  const options = { agent: 'codex', cwd: root };
  try {
    assert.equal(preToolUse(options, 'issue-create-session', 'Bash', { command: 'gh issue create --title "새 기능"' }).permissionDecision, 'deny');
    assert.equal(preToolUse(options, 'issue-create-session', 'Bash', { command: 'gh issue create --title "새 기능" --label "type: feature"' }).permissionDecision, undefined);
  } finally {
    removeDirectory(root);
  }
});

test('허용 응답은 Agent별 PreToolUse 프로토콜을 따른다', () => {
  const root = setupRepository();
  try {
    const codexOutput = preToolUse({ agent: 'codex', cwd: root }, 'codex-session', 'Bash', {
      command: 'git status --short',
    });
    const claudeOutput = preToolUse({ agent: 'claude', cwd: root }, 'claude-session', 'Bash', {
      command: 'git status --short',
    });

    assert.equal(Object.hasOwn(codexOutput, 'permissionDecision'), false);
    assert.equal(claudeOutput.permissionDecision, 'allow');
  } finally {
    removeDirectory(root);
  }
});
