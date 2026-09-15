import { appendEvent, hasEvent, readEvents } from './events.mjs';
import { diffStat, gitMetadata, headTree, snapshotTree } from './git.mjs';
import { getIssue } from './github.mjs';
import { preparePullRequest } from './pr.mjs';
import { findRepositoryRoot, loadConfig, run } from './process.mjs';
import { resolveState, saveState } from './state.mjs';

function valuesOf(args, name) {
  return args.flatMap((arg, index) => (arg === name && index + 1 < args.length ? [args[index + 1]] : []));
}

function valueOf(args, name) {
  return valuesOf(args, name)[0] ?? null;
}

function hasAnswerAfter(events, index) {
  return events.slice(index + 1).some((event) => event.type === 'USER_PROMPTED' || event.type === 'GRILL_ME_ANSWER');
}

export function runLifecycle(args, cwd = process.cwd()) {
  const [group, action] = args;
  const root = findRepositoryRoot(cwd);
  const config = loadConfig(root);

  if (group === 'bootstrap' && action === 'start') {
    const issue = Number(valueOf(args, '--issue'));
    const sessionId = valueOf(args, '--session') ?? `bootstrap-${issue}`;
    if (!Number.isInteger(issue) || issue <= 0) throw new Error('bootstrap start에는 올바른 --issue 번호가 필요합니다.');
    const issueData = getIssue(root, config.repository, issue);
    if (issueData.state !== 'OPEN') throw new Error(`Issue #${issue}가 닫혀 있습니다.`);
    const metadata = gitMetadata(root);
    const baseline = run('git', ['rev-parse', 'HEAD^{tree}'], { cwd: root });
    const state = {
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
    appendEvent(root, issue, { type: 'SESSION_STARTED', sessionId, agent: state.agent, cwd: root, branch: state.branch, head: state.head, gitStatus: state.initialStatus, bootstrap: true });
    appendEvent(root, issue, { type: 'ISSUE_BOUND', issue, bootstrap: true });
    saveState(root, state);
    return sessionId;
  }

  const state = resolveState(root, valueOf(args, '--session'));
  if (!state.issue) throw new Error('연결된 Issue가 없습니다.');
  const text = valueOf(args, '--text');
  const bootstrap = state.bootstrap ? { bootstrap: true } : {};

  if (group === 'bootstrap') {
    if (!text) throw new Error(`bootstrap ${action}에는 --text가 필요합니다.`);
    if (action === 'prompt') {
      appendEvent(root, state.issue, { type: 'USER_PROMPTED', issue: state.issue, prompt: text, redacted: false, ...bootstrap });
    } else if (action === 'answer') {
      appendEvent(root, state.issue, { type: 'GRILL_ME_ANSWER', issue: state.issue, answer: text, redacted: false, ...bootstrap });
    } else {
      throw new Error(`지원하지 않는 bootstrap 명령입니다: ${action}`);
    }
  } else if (group === 'grill') {
    if (action === 'start') {
      const events = readEvents(root, state.issue);
      const lastStarted = events.findLastIndex((event) => event.type === 'GRILL_ME_STARTED');
      const lastFinished = events.findLastIndex((event) => event.type === 'GRILL_ME_FINISHED');
      if (lastStarted <= lastFinished) appendEvent(root, state.issue, { type: 'GRILL_ME_STARTED', issue: state.issue, ...bootstrap });
      state.phase = 'GRILLING';
    } else if (action === 'question') {
      if (!text) throw new Error('question에는 --text로 질문을 적어 주세요.');
      appendEvent(root, state.issue, { type: 'GRILL_ME_QUESTION', issue: state.issue, question: text, ...bootstrap });
    } else if (action === 'decision') {
      if (!text) throw new Error('decision에는 --text로 정한 내용을 적어 주세요.');
      appendEvent(root, state.issue, { type: 'GRILL_ME_DECISION', issue: state.issue, decision: text, ...bootstrap });
    } else if (action === 'finish') {
      const events = readEvents(root, state.issue);
      const lastStarted = events.findLastIndex((event) => event.type === 'GRILL_ME_STARTED');
      const currentRound = lastStarted >= 0 ? events.slice(lastStarted) : [];
      for (const type of ['GRILL_ME_STARTED', 'GRILL_ME_QUESTION', 'GRILL_ME_ANSWER', 'GRILL_ME_DECISION']) {
        if (!hasEvent(currentRound, type)) throw new Error(`${type} 기록이 없어 grill-me를 끝낼 수 없습니다.`);
      }
      appendEvent(root, state.issue, { type: 'GRILL_ME_FINISHED', issue: state.issue, ...bootstrap });
      state.phase = 'GRILL_COMPLETE';
    } else {
      throw new Error(`지원하지 않는 grill 명령입니다: ${action}`);
    }
  } else if (group === 'adr') {
    if (action === 'reopen') {
      if (!text) throw new Error('reopen에는 --text로 다시 논의하는 이유를 적어 주세요.');
      appendEvent(root, state.issue, { type: 'ADR_REOPENED', issue: state.issue, reason: text, ...bootstrap });
      state.phase = 'ADR_REOPENED';
    } else if (action === 'changed') {
      if (!text) throw new Error('changed에는 --text로 바뀐 결정을 적어 주세요.');
      appendEvent(root, state.issue, { type: 'ADR_CHANGED', issue: state.issue, decision: text, ...bootstrap });
      state.phase = 'READY_TO_IMPLEMENT';
    } else if (action === 'skip') {
      if (!text) throw new Error('skip에는 --text로 ADR이 필요 없는 이유를 적어 주세요.');
      const events = readEvents(root, state.issue);
      const lastStarted = events.findLastIndex((event) => event.type === 'GRILL_ME_STARTED');
      if (lastStarted < 0 || !hasAnswerAfter(events, lastStarted)) {
        throw new Error('ADR이 필요 없다는 사용자 답이 없습니다. grill-me에서 ADR이 필요한지 먼저 물어봐 주세요.');
      }
      appendEvent(root, state.issue, { type: 'ADR_SKIPPED', issue: state.issue, reason: text, ...bootstrap });
    } else {
      throw new Error(`지원하지 않는 adr 명령입니다: ${action}`);
    }
  } else if (group === 'commit') {
    if (action === 'explain') {
      if (!text) throw new Error('explain에는 --text로 무엇을, 왜, 어느 파일에서 바꿨는지 적어 주세요.');
      const tree = snapshotTree(root);
      appendEvent(root, state.issue, { type: 'COMMIT_EXPLAINED', issue: state.issue, explanation: text, diffStat: diffStat(root, headTree(root), tree), tree, ...bootstrap });
    } else if (action === 'confirm') {
      const events = readEvents(root, state.issue);
      const lastExplained = events.findLastIndex((event) => event.type === 'COMMIT_EXPLAINED');
      if (lastExplained < 0) throw new Error('커밋 설명 기록이 없습니다. 먼저 `commit explain`으로 설명을 기록해 주세요.');
      if (!hasAnswerAfter(events, lastExplained)) throw new Error('설명에 대한 개발자 답이 없습니다. 개발자에게 이대로 커밋해도 되는지 묻고 답을 받아 주세요.');
      const tree = snapshotTree(root);
      if (events[lastExplained].tree !== tree) throw new Error('설명한 뒤 코드가 바뀌었습니다. 바뀐 내용까지 다시 설명하고 확인받아 주세요.');
      appendEvent(root, state.issue, { type: 'COMMIT_CONFIRMED', issue: state.issue, tree, ...bootstrap });
      state.commitConfirmedTree = tree;
    } else {
      throw new Error(`지원하지 않는 commit 명령입니다: ${action}`);
    }
  } else if (group === 'pr' && action === 'plan') {
    const summary = valuesOf(args, '--summary');
    if (!summary.length) throw new Error('pr plan에는 --summary로 변경 요약을 하나 이상 적어 주세요.');
    appendEvent(root, state.issue, { type: 'PR_PLANNED', issue: state.issue, summary, review: valuesOf(args, '--review'), ...bootstrap });
  } else if (group === 'pr' && action === 'prepare') {
    const events = readEvents(root, state.issue);
    if (!hasEvent(events, 'PR_REQUESTED')) appendEvent(root, state.issue, { type: 'PR_REQUESTED', issue: state.issue, ...bootstrap });
    const prepared = preparePullRequest({ root, config, state, requireTracked: false });
    saveState(root, state);
    return prepared.bodyPath;
  } else {
    throw new Error(`지원하지 않는 명령입니다: ${group} ${action}`);
  }

  saveState(root, state);
  return 'OK';
}
