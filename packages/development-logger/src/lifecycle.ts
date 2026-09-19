import { appendEvent, flushPending, hasEvent, readEvents } from './events.ts';
import { diffStat, gitMetadata, headTree, snapshotTree } from './git.ts';
import { getIssue } from './github.ts';
import { preparePullRequest } from './pr.ts';
import { findRepositoryRoot, loadConfig, run } from './process.ts';
import { resolveState, saveState } from './state.ts';
import type { IssueService, LogEvent, LoggerConfig, SessionState } from './types.ts';

type Context = {
  args: string[];
  root: string;
  config: LoggerConfig;
  state: SessionState;
  services: IssueService;
  /** bootstrap 세션의 이벤트에만 붙는 표시. 일반 세션에서는 빈 객체다. */
  mark: { bootstrap?: true };
};

function valuesOf(args: string[], name: string): string[] {
  return args.flatMap((arg, index) => (arg === name && index + 1 < args.length ? [args[index + 1] as string] : []));
}

function valueOf(args: string[], name: string): string | null {
  return valuesOf(args, name)[0] ?? null;
}

function issueOf(args: string[], command: string): number {
  const issue = Number(valueOf(args, '--issue'));
  if (!Number.isInteger(issue) || issue <= 0) throw new Error(`${command}에는 올바른 --issue 번호가 필요합니다.`);
  return issue;
}

function textOf(args: string[], message: string): string {
  const text = valueOf(args, '--text');
  if (!text) throw new Error(message);
  return text;
}

function requireOpenIssue(root: string, config: LoggerConfig, issue: number, services: IssueService): void {
  if (services.getIssue(root, config.repository, issue).state !== 'OPEN') {
    throw new Error(`Issue #${issue}가 닫혀 있어 연결할 수 없습니다.`);
  }
}

function startIssueLog(root: string, state: SessionState, issue: number, source: string): void {
  appendEvent(root, issue, {
    type: 'SESSION_STARTED',
    sessionId: state.sessionId,
    agent: state.agent,
    cwd: state.cwd,
    branch: state.branch,
    head: state.head,
    gitStatus: state.initialStatus,
  });
  appendEvent(root, issue, { type: 'ISSUE_BOUND', issue, source });
}

function lastIndexOfType(events: LogEvent[], type: string): number {
  return events.findLastIndex((event) => event.type === type);
}

function hasAnswerAfter(events: LogEvent[], index: number): boolean {
  return events.slice(index + 1).some((event) => event.type === 'USER_PROMPTED' || event.type === 'GRILL_ME_ANSWER');
}

function startBootstrapSession(args: string[], root: string, config: LoggerConfig, services: IssueService): string {
  const issue = issueOf(args, 'bootstrap start');
  const sessionId = valueOf(args, '--session') ?? `bootstrap-${issue}`;
  requireOpenIssue(root, config, issue, services);
  const metadata = gitMetadata(root);
  const baseline = run('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root });
  const state: SessionState = {
    sessionId,
    agent: 'CODEX',
    cwd: root,
    issue,
    issueRead: true,
    phase: 'RESEARCHING',
    branch: metadata.branch,
    head: metadata.head,
    initialStatus: metadata.status,
    previousTree: baseline,
    turnStartTree: baseline,
    bootstrap: true,
    validations: {},
    startedAt: new Date().toISOString(),
  };
  appendEvent(root, issue, {
    type: 'SESSION_STARTED',
    sessionId,
    agent: state.agent,
    cwd: root,
    branch: state.branch,
    head: state.head,
    gitStatus: state.initialStatus,
    bootstrap: true,
  });
  appendEvent(root, issue, { type: 'ISSUE_BOUND', issue, bootstrap: true });
  saveState(root, state);
  return sessionId;
}

function handleIssue(action: string, { args, root, config, state, services }: Context): string {
  if (action === 'bind') {
    const issue = issueOf(args, 'issue bind');
    if (state.issue === issue) return 'OK';
    if (state.issue) throw new Error(`이미 Issue #${state.issue}에 연결되어 있습니다. 바꾸려면 issue rebind를 써 주세요.`);
    requireOpenIssue(root, config, issue, services);
    state.issue = issue;
    state.issueRead = true;
    state.phase = 'RESEARCHING';
    startIssueLog(root, state, issue, 'USER_CONFIRMED');
    return 'OK';
  }

  if (action === 'rebind') {
    const issue = issueOf(args, 'issue rebind');
    const reason = textOf(args, 'issue rebind에는 --text로 Issue를 바꾸는 이유를 적어 주세요.');
    if (!state.issue) throw new Error('연결된 Issue가 없습니다. issue bind를 써 주세요.');
    if (state.issue === issue) throw new Error(`이미 Issue #${issue}에 연결되어 있습니다.`);
    requireOpenIssue(root, config, issue, services);
    appendEvent(root, state.issue, { type: 'ISSUE_REBOUND', issue: state.issue, from: state.issue, to: issue, reason });
    state.issue = issue;
    state.issueRead = true;
    state.phase = 'RESEARCHING';
    startIssueLog(root, state, issue, 'REBIND');
    return 'OK';
  }

  throw new Error(`지원하지 않는 issue 명령입니다: ${action}`);
}

function handleBootstrap(action: string, { args, root, state, mark }: Context): void {
  const issue = state.issue as number;
  const text = textOf(args, `bootstrap ${action}에는 --text가 필요합니다.`);
  if (action === 'prompt') {
    appendEvent(root, issue, { type: 'USER_PROMPTED', issue, prompt: text, redacted: false, ...mark });
  } else if (action === 'answer') {
    appendEvent(root, issue, { type: 'GRILL_ME_ANSWER', issue, answer: text, redacted: false, ...mark });
  } else {
    throw new Error(`지원하지 않는 bootstrap 명령입니다: ${action}`);
  }
}

function handleGrill(action: string, { args, root, state, mark }: Context): void {
  const issue = state.issue as number;

  if (action === 'start') {
    const events = readEvents(root, issue);
    if (lastIndexOfType(events, 'GRILL_ME_STARTED') <= lastIndexOfType(events, 'GRILL_ME_FINISHED')) {
      appendEvent(root, issue, { type: 'GRILL_ME_STARTED', issue, ...mark });
    }
    state.phase = 'GRILLING';
    return;
  }

  if (action === 'question') {
    const question = textOf(args, 'question에는 --text로 질문을 적어 주세요.');
    appendEvent(root, issue, { type: 'GRILL_ME_QUESTION', issue, question, ...mark });
    return;
  }

  if (action === 'decision') {
    const decision = textOf(args, 'decision에는 --text로 정한 내용을 적어 주세요.');
    appendEvent(root, issue, { type: 'GRILL_ME_DECISION', issue, decision, ...mark });
    return;
  }

  if (action === 'finish') {
    const events = readEvents(root, issue);
    const started = lastIndexOfType(events, 'GRILL_ME_STARTED');
    const round = started >= 0 ? events.slice(started) : [];
    for (const type of ['GRILL_ME_STARTED', 'GRILL_ME_QUESTION', 'GRILL_ME_ANSWER', 'GRILL_ME_DECISION'] as const) {
      if (!hasEvent(round, type)) throw new Error(`${type} 기록이 없어 grill-me를 끝낼 수 없습니다.`);
    }
    appendEvent(root, issue, { type: 'GRILL_ME_FINISHED', issue, ...mark });
    state.phase = 'GRILL_COMPLETE';
    return;
  }

  throw new Error(`지원하지 않는 grill 명령입니다: ${action}`);
}

function handleAdr(action: string, { args, root, state, mark }: Context): void {
  const issue = state.issue as number;

  if (action === 'reopen') {
    const reason = textOf(args, 'reopen에는 --text로 다시 논의하는 이유를 적어 주세요.');
    appendEvent(root, issue, { type: 'ADR_REOPENED', issue, reason, ...mark });
    state.phase = 'ADR_REOPENED';
    return;
  }

  if (action === 'changed') {
    const decision = textOf(args, 'changed에는 --text로 바뀐 결정을 적어 주세요.');
    appendEvent(root, issue, { type: 'ADR_CHANGED', issue, decision, ...mark });
    state.phase = 'READY_TO_IMPLEMENT';
    return;
  }

  if (action === 'skip') {
    const reason = textOf(args, 'skip에는 --text로 ADR이 필요 없는 이유를 적어 주세요.');
    const events = readEvents(root, issue);
    const started = lastIndexOfType(events, 'GRILL_ME_STARTED');
    if (started < 0 || !hasAnswerAfter(events, started)) {
      throw new Error('ADR이 필요 없다는 사용자 답이 없습니다. grill-me에서 ADR이 필요한지 먼저 물어봐 주세요.');
    }
    appendEvent(root, issue, { type: 'ADR_SKIPPED', issue, reason, ...mark });
    return;
  }

  throw new Error(`지원하지 않는 adr 명령입니다: ${action}`);
}

function handleCommit(action: string, context: Context): string {
  const { args, root, state, mark } = context;
  const issue = state.issue as number;

  if (action === 'explain') {
    const explanation = textOf(args, 'explain에는 --text로 무엇을, 왜, 어느 파일에서 바꿨는지 적어 주세요.');
    const tree = snapshotTree(root);
    appendEvent(root, issue, {
      type: 'COMMIT_EXPLAINED',
      issue,
      explanation,
      diffStat: diffStat(root, headTree(root), tree),
      tree,
      ...mark,
    });
    saveState(root, state);
    return 'OK';
  }

  if (action === 'confirm') {
    const events = readEvents(root, issue);
    const explained = lastIndexOfType(events, 'COMMIT_EXPLAINED');
    if (explained < 0) throw new Error('커밋 설명 기록이 없습니다. 먼저 `commit explain`으로 설명을 기록해 주세요.');
    if (!hasAnswerAfter(events, explained)) throw new Error('설명에 대한 개발자 답이 없습니다. 개발자에게 이대로 커밋해도 되는지 묻고 답을 받아 주세요.');
    const tree = snapshotTree(root);
    if (events[explained]?.tree !== tree) throw new Error('설명한 뒤 코드가 바뀌었습니다. 바뀐 내용까지 다시 설명하고 확인받아 주세요.');

    appendEvent(root, issue, { type: 'COMMIT_CONFIRMED', issue, tree, ...mark });
    state.commitConfirmedTree = tree;
    saveState(root, state);
    const flushed = flushPending(root, issue);
    return `OK 작업 기록 ${flushed.events}건을 .devlog/${issue}/로 내보냈습니다. 코드와 함께 커밋해 주세요.`;
  }

  throw new Error(`지원하지 않는 commit 명령입니다: ${action}`);
}

function handlePullRequest(action: string, context: Context): string {
  const { args, root, config, state, mark } = context;
  const issue = state.issue as number;

  if (action === 'plan') {
    const summary = valuesOf(args, '--summary');
    if (!summary.length) throw new Error('pr plan에는 --summary로 변경 요약을 하나 이상 적어 주세요.');
    appendEvent(root, issue, { type: 'PR_PLANNED', issue, summary, review: valuesOf(args, '--review'), ...mark });
    saveState(root, state);
    return 'OK';
  }

  if (action === 'prepare') {
    if (!hasEvent(readEvents(root, issue), 'PR_REQUESTED')) {
      appendEvent(root, issue, { type: 'PR_REQUESTED', issue, ...mark });
    }
    const prepared = preparePullRequest({ root, config, state, requireTracked: false });
    saveState(root, state);
    return prepared.bodyPath;
  }

  throw new Error(`지원하지 않는 pr 명령입니다: ${action}`);
}

export function runLifecycle(args: string[], cwd: string = process.cwd(), services: IssueService = { getIssue }): string {
  const [group, action = ''] = args;
  const root = findRepositoryRoot(cwd);
  const config = loadConfig(root);

  if (group === 'bootstrap' && action === 'start') {
    return startBootstrapSession(args, root, config, services);
  }

  const state = resolveState(root, valueOf(args, '--session'));
  const context: Context = { args, root, config, state, services, mark: state.bootstrap ? { bootstrap: true } : {} };

  if (group === 'issue') {
    const result = handleIssue(action, context);
    saveState(root, state);
    return result;
  }

  if (!state.issue) throw new Error('연결된 Issue가 없습니다.');

  if (group === 'commit') return handleCommit(action, context);
  if (group === 'pr') return handlePullRequest(action, context);

  if (group === 'bootstrap') handleBootstrap(action, context);
  else if (group === 'grill') handleGrill(action, context);
  else if (group === 'adr') handleAdr(action, context);
  else throw new Error(`지원하지 않는 명령입니다: ${group} ${action}`);

  saveState(root, state);
  return 'OK';
}
