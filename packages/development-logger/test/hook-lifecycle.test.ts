import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { pendingDirectory, readEvents } from '../src/events.ts';
import type { HookOutput, IssueService, LogEvent, ToolInput } from '../src/types.ts';
import { handleHook } from '../src/hook.ts';
import { runLifecycle } from '../src/lifecycle.ts';
import { removeDirectory, temporaryDirectory } from '../src/git.ts';
import { run } from '../src/process.ts';

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

function issueWithoutAdr(body = '## 해결하려는 문제\n- 설정이 없다') {
  return {
    number: 106,
    title: 'AX 설정',
    body,
    state: 'OPEN',
    comments: [],
    url: 'https://example.test/issues/106',
  };
}

function issueWithAdr() {
  return {
    number: 106,
    title: 'AX 설정',
    body: '## ADR\n### 결정\n- Node core\n### 이유\n- 공통 처리\n### 근거\n- 공식 schema\n### 검증\n- node test',
    state: 'OPEN',
    comments: [],
    url: 'https://example.test/issues/106',
  };
}

type Options = {
  agent: string;
  cwd: string;
  services?: IssueService;
};

function prompt(options: Options, session: string, turnId: string, text: string): HookOutput {
  return handleHook({
    ...options,
    payload: { hook_event_name: 'UserPromptSubmit', session_id: session, cwd: options.cwd, turn_id: turnId, prompt: text },
  });
}

function stop(options: Options, session: string, turnId: string): HookOutput {
  return handleHook({
    ...options,
    payload: { hook_event_name: 'Stop', session_id: session, cwd: options.cwd, turn_id: turnId },
  });
}

function preToolUse(options: Options, session: string, toolName: string, toolInput: ToolInput) {
  const output = handleHook({
    ...options,
    payload: { hook_event_name: 'PreToolUse', session_id: session, cwd: options.cwd, tool_name: toolName, tool_input: toolInput },
  }).hookSpecificOutput;
  if (!output) throw new Error('PreToolUse 응답이 비어 있습니다.');
  return output;
}

function contextOf(output: HookOutput): string {
  const context = output.hookSpecificOutput?.additionalContext;
  if (!context) throw new Error('additionalContext가 없습니다.');
  return context;
}

function requireEvent(events: LogEvent[], type: string): LogEvent {
  const found = events.find((event) => event.type === type);
  if (!found) throw new Error(`${type} 기록이 없습니다.`);
  return found;
}

function startSession(options: Options, session: string, issue: number | null = 106): void {
  handleHook({
    ...options,
    payload: { hook_event_name: 'SessionStart', session_id: session, cwd: options.cwd, source: 'startup' },
  });
  if (issue) runLifecycle(['issue', 'bind', '--session', session, '--issue', String(issue)], options.cwd, options.services);
}

function finishGrillWithoutAdr(options: Options, session: string): void {
  const root = options.cwd;
  prompt(options, session, '1', '설계 이야기 하자');
  runLifecycle(['grill', 'start', '--session', session], root, options.services);
  runLifecycle(['grill', 'question', '--session', session, '--text', '이번 작업에 ADR이 필요한가요?'], root, options.services);
  prompt(options, session, '2', '기술 선택이 없어서 필요 없어요');
  runLifecycle(['grill', 'decision', '--session', session, '--text', 'ADR 없이 진행한다.'], root, options.services);
  runLifecycle(['grill', 'finish', '--session', session], root, options.services);
}

test('Issue binding부터 grill-me, ADR Gate, Turn Diff까지 연결한다', () => {
  const root = setupRepository();
  const session = 'integration-session';
  const options = { agent: 'codex', cwd: root, services: { getIssue: () => issueWithAdr() } };
  try {
    startSession(options, session);
    prompt(options, session, '1', '시작해줘');
    runLifecycle(['grill', 'start', '--session', session], root, options.services);
    runLifecycle(['grill', 'question', '--session', session, '--text', '공통 core를 사용할 것인가?'], root, options.services);
    prompt(options, session, '2', '공통 core로 해줘');
    runLifecycle(['grill', 'decision', '--session', session, '--text', '공통 core를 사용한다.'], root, options.services);
    runLifecycle(['grill', 'finish', '--session', session], root, options.services);

    assert.equal(preToolUse(options, session, 'apply_patch', {}).permissionDecision, undefined);

    writeFileSync(join(root, 'tracked.txt'), 'after\n');
    stop(options, session, '2');

    const events = readEvents(root, 106);
    for (const type of ['SESSION_STARTED', 'ISSUE_BOUND', 'GRILL_ME_STARTED', 'GRILL_ME_QUESTION', 'GRILL_ME_ANSWER', 'GRILL_ME_DECISION', 'GRILL_ME_FINISHED', 'ADR_CREATED', 'TURN_FINISHED']) {
      assert.equal(events.some((event) => event.type === type), true, type);
    }
    const turn = requireEvent(events, 'TURN_FINISHED');
    assert.equal(Object.hasOwn(turn, 'assistantMessage'), false);
    const diff = readFileSync(join(pendingDirectory(root, 106), String(turn.diff)), 'utf8');
    assert.match(diff, /tracked\.txt/);
    assert.doesNotMatch(diff, /\.devlog/);
  } finally {
    removeDirectory(root);
  }
});

test('작업 중 기록은 워킹트리 밖에 쌓이고 커밋 확인 시점에 .devlog로 내보낸다', () => {
  const root = setupRepository();
  const session = 'flush-session';
  const options = { agent: 'claude', cwd: root, services: { getIssue: () => issueWithoutAdr() } };
  try {
    startSession(options, session);
    prompt(options, session, '1', '바로 구현하자');
    writeFileSync(join(root, 'tracked.txt'), 'after\n');
    stop(options, session, '1');

    assert.equal(existsSync(join(root, '.devlog', '106')), false, '작업 중에는 .devlog가 생기지 않는다');
    assert.equal(run('git', ['status', '--short'], { cwd: root }).includes('.devlog'), false);

    runLifecycle(['commit', 'explain', '--session', session, '--text', 'tracked.txt를 after로 바꿨다.'], root, options.services);
    prompt(options, session, '2', '좋아 커밋해');
    const message = runLifecycle(['commit', 'confirm', '--session', session], root, options.services);

    assert.match(message, /내보냈습니다/);
    const exported = readdirSync(join(root, '.devlog', '106'));
    assert.equal(exported.includes('events.jsonl'), true);
    assert.equal(exported.some((name) => name.endsWith('.diff')), true);
    assert.equal(existsSync(pendingDirectory(root, 106)), false, '내보낸 뒤 pending은 비운다');
  } finally {
    removeDirectory(root);
  }
});

test('코드가 바뀌지 않은 턴은 diff 파일을 만들지 않는다', () => {
  const root = setupRepository();
  const session = 'empty-turn-session';
  const options = { agent: 'claude', cwd: root, services: { getIssue: () => issueWithoutAdr() } };
  try {
    startSession(options, session);
    prompt(options, session, '1', '설명만 해줘');
    stop(options, session, '1');

    const turn = requireEvent(readEvents(root, 106), 'TURN_FINISHED');
    assert.equal(Object.hasOwn(turn, 'diff'), false);
    assert.equal(Object.hasOwn(turn, 'testResult'), false);
    assert.equal(readdirSync(pendingDirectory(root, 106)).some((name) => name.endsWith('.diff')), false);
  } finally {
    removeDirectory(root);
  }
});

test('PR 생성이 끝나면 내보내지 않은 잔여 기록을 폐기한다', () => {
  const root = setupRepository();
  const session = 'pr-discard-session';
  const options = { agent: 'claude', cwd: root, services: { getIssue: () => issueWithoutAdr() } };
  try {
    startSession(options, session);
    prompt(options, session, '1', '작업 시작');
    assert.equal(readEvents(root, 106).length > 0, true);

    handleHook({
      ...options,
      payload: {
        hook_event_name: 'PostToolUse',
        session_id: session,
        cwd: root,
        tool_name: 'Bash',
        tool_input: { command: 'gh pr create --base release-be' },
        tool_response: { exit_code: 0 },
      },
    });

    assert.equal(existsSync(pendingDirectory(root, 106)), false);
    assert.equal(readEvents(root, 106).length, 0);
  } finally {
    removeDirectory(root);
  }
});

test('Issue 본문에 내용이 있으면 grill-me 없이 구현을 허용하고 건너뛴 사실을 남긴다', () => {
  const root = setupRepository();
  const session = 'grill-skip-session';
  const options = { agent: 'claude', cwd: root, services: { getIssue: () => issueWithoutAdr() } };
  try {
    startSession(options, session);
    assert.equal(preToolUse(options, session, 'Edit', { file_path: 'tracked.txt' }).permissionDecision, 'allow');
    assert.equal(readEvents(root, 106).some((event) => event.type === 'GRILL_ME_SKIPPED'), true);
  } finally {
    removeDirectory(root);
  }
});

test('Issue 본문이 비어 있으면 구현을 막는다', () => {
  const root = setupRepository();
  const session = 'empty-issue-session';
  const options = { agent: 'claude', cwd: root, services: { getIssue: () => issueWithoutAdr('## 해결하려는 문제\n\n-\n\n## 완료 조건\n\n- [ ]\n') } };
  try {
    startSession(options, session);
    const denied = preToolUse(options, session, 'Edit', { file_path: 'tracked.txt' });
    assert.equal(denied.permissionDecision, 'deny');
    assert.match(String(denied.permissionDecisionReason), /본문이 비어 있어/);
  } finally {
    removeDirectory(root);
  }
});

test('차단은 작업 기록에 남고 같은 턴의 같은 차단은 한 번만 쌓인다', () => {
  const root = setupRepository();
  const session = 'denied-session';
  const options = { agent: 'claude', cwd: root, services: { getIssue: () => issueWithoutAdr('') } };
  try {
    startSession(options, session);
    prompt(options, session, '1', '고쳐줘');
    preToolUse(options, session, 'Edit', { file_path: 'tracked.txt' });
    preToolUse(options, session, 'Edit', { file_path: 'tracked.txt' });

    const denials = readEvents(root, 106).filter((event) => event.type === 'TOOL_DENIED');
    assert.equal(denials.length, 1);
    assert.equal(denials[0]?.tool, 'Edit');
    assert.equal(String(denials[0]?.reason).includes('\n'), false);
  } finally {
    removeDirectory(root);
  }
});

test('잘못 연결한 Issue는 rebind로 양쪽 기록을 남기며 바꾼다', () => {
  const root = setupRepository();
  const session = 'rebind-session';
  const options: Options = {
    agent: 'claude',
    cwd: root,
    services: { getIssue: (_root: string, _repository: string, number: number) => ({ ...issueWithoutAdr(), number }) },
  };
  try {
    startSession(options, session, 121);
    runLifecycle(['issue', 'rebind', '--session', session, '--issue', '101', '--text', '진단용 조회로 잘못 연결됐다.'], root, options.services);

    const previous = readEvents(root, 121);
    const current = readEvents(root, 101);
    assert.equal(previous.some((event) => event.type === 'ISSUE_REBOUND' && event.to === 101), true);
    assert.equal(current.some((event) => event.type === 'ISSUE_BOUND' && event.source === 'REBIND'), true);
    assert.throws(() => runLifecycle(['issue', 'rebind', '--session', session, '--issue', '102'], root, options.services), /--text/);
  } finally {
    removeDirectory(root);
  }
});

test('Issue 번호가 보여도 자동으로 연결하지 않고 확인을 요청한다', () => {
  const root = setupRepository();
  const session = 'no-autobind-session';
  const options = { agent: 'claude', cwd: root, services: { getIssue: () => issueWithoutAdr() } };
  try {
    handleHook({
      ...options,
      payload: { hook_event_name: 'SessionStart', session_id: session, cwd: root, source: 'startup' },
    });
    const context = contextOf(prompt(options, session, '1', 'Issue 106 진행하자'));
    assert.match(context, /Issue #106/);
    assert.match(context, /issue bind/);
    assert.equal(readEvents(root, 106).length, 0, '확인 전에는 기록을 만들지 않는다');

    const viewed = preToolUse(options, session, 'Bash', { command: 'gh issue view 106 --json title,body' });
    assert.equal(viewed.permissionDecision, 'allow');
    assert.equal(readEvents(root, 106).length, 0, 'gh issue view로는 연결하지 않는다');
  } finally {
    removeDirectory(root);
  }
});

test('사용자가 ADR이 필요 없다고 답하면 Issue 본문 ADR 없이 구현을 허용한다', () => {
  const root = setupRepository();
  const session = 'adr-skip-session';
  const options = { agent: 'claude', cwd: root, services: { getIssue: () => issueWithoutAdr() } };
  try {
    startSession(options, session);
    finishGrillWithoutAdr(options, session);
    assert.equal(preToolUse(options, session, 'Edit', { file_path: 'tracked.txt' }).permissionDecision, 'deny');

    runLifecycle(['adr', 'skip', '--session', session, '--text', '기술 선택이 없는 작업이다.'], root, options.services);
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
    startSession(options, session);
    runLifecycle(['grill', 'start', '--session', session], root, options.services);
    assert.throws(() => runLifecycle(['adr', 'skip', '--session', session, '--text', '필요 없음'], root, options.services), /사용자 답이 없습니다/);
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
    startSession(options, session);
    prompt(options, session, '1', '고치자');
    writeFileSync(join(root, 'tracked.txt'), 'after\n');

    const denied = preToolUse(options, session, 'Bash', commit);
    assert.equal(denied.permissionDecision, 'deny');
    assert.match(String(denied.permissionDecisionReason), /설명하고 확인/);

    runLifecycle(['commit', 'explain', '--session', session, '--text', 'tracked.txt 내용을 after로 바꿨다.'], root, options.services);
    assert.throws(() => runLifecycle(['commit', 'confirm', '--session', session], root, options.services), /개발자 답이 없습니다/);
    prompt(options, session, '3', '좋아, 커밋해');
    runLifecycle(['commit', 'confirm', '--session', session], root, options.services);
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
    startSession(options, session);
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
    assert.match(String(output.permissionDecisionReason), /gh pr create/);
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
