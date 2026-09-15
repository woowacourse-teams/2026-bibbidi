import { appendEvent, hasEvent, readEvents } from './events.mjs';
import { gitMetadata } from './git.mjs';
import { getIssue } from './github.mjs';
import { preparePullRequest } from './pr.mjs';
import { findRepositoryRoot, loadConfig, run } from './process.mjs';
import { resolveState, saveState } from './state.mjs';

function valueOf(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

export function runLifecycle(args, cwd = process.cwd()) {
  const [group, action] = args;
  const root = findRepositoryRoot(cwd);
  const config = loadConfig(root);

  if (group === 'bootstrap' && action === 'start') {
    const issue = Number(valueOf(args, '--issue'));
    const sessionId = valueOf(args, '--session') ?? `bootstrap-${issue}`;
    if (!Number.isInteger(issue) || issue <= 0) throw new Error('bootstrap start에는 유효한 --issue가 필요합니다.');
    const issueData = getIssue(root, config.repository, issue);
    if (issueData.state !== 'OPEN') throw new Error(`Issue #${issue}가 열려 있지 않습니다.`);
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
  if (!state.issue) throw new Error('Issue가 연결되지 않았습니다.');
  const text = valueOf(args, '--text');
  const bootstrap = state.bootstrap ? { bootstrap: true } : {};

  if (group === 'bootstrap') {
    if (!text) throw new Error(`bootstrap ${action}에는 --text가 필요합니다.`);
    if (action === 'prompt') {
      appendEvent(root, state.issue, { type: 'USER_PROMPTED', issue: state.issue, prompt: text, redacted: false, ...bootstrap });
    } else if (action === 'answer') {
      appendEvent(root, state.issue, { type: 'GRILL_ME_ANSWER', issue: state.issue, answer: text, redacted: false, ...bootstrap });
    } else {
      throw new Error(`지원하지 않는 bootstrap action입니다: ${action}`);
    }
  } else if (group === 'grill') {
    if (action === 'start') {
      const events = readEvents(root, state.issue);
      const lastStarted = events.findLastIndex((event) => event.type === 'GRILL_ME_STARTED');
      const lastFinished = events.findLastIndex((event) => event.type === 'GRILL_ME_FINISHED');
      if (lastStarted <= lastFinished) appendEvent(root, state.issue, { type: 'GRILL_ME_STARTED', issue: state.issue, ...bootstrap });
      state.phase = 'GRILLING';
    } else if (action === 'question') {
      if (!text) throw new Error('question에는 --text가 필요합니다.');
      appendEvent(root, state.issue, { type: 'GRILL_ME_QUESTION', issue: state.issue, question: text, ...bootstrap });
    } else if (action === 'decision') {
      if (!text) throw new Error('decision에는 --text가 필요합니다.');
      appendEvent(root, state.issue, { type: 'GRILL_ME_DECISION', issue: state.issue, decision: text, ...bootstrap });
    } else if (action === 'finish') {
      const events = readEvents(root, state.issue);
      const lastStarted = events.findLastIndex((event) => event.type === 'GRILL_ME_STARTED');
      const currentRound = lastStarted >= 0 ? events.slice(lastStarted) : [];
      for (const type of ['GRILL_ME_STARTED', 'GRILL_ME_QUESTION', 'GRILL_ME_ANSWER', 'GRILL_ME_DECISION']) {
        if (!hasEvent(currentRound, type)) throw new Error(`${type} Event가 없어 grill-me를 종료할 수 없습니다.`);
      }
      appendEvent(root, state.issue, { type: 'GRILL_ME_FINISHED', issue: state.issue, ...bootstrap });
      state.phase = 'GRILL_COMPLETE';
    } else {
      throw new Error(`지원하지 않는 grill action입니다: ${action}`);
    }
  } else if (group === 'adr') {
    if (action === 'reopen') {
      if (!text) throw new Error('reopen에는 --text가 필요합니다.');
      appendEvent(root, state.issue, { type: 'ADR_REOPENED', issue: state.issue, reason: text, ...bootstrap });
      state.phase = 'ADR_REOPENED';
    } else if (action === 'changed') {
      if (!text) throw new Error('changed에는 --text가 필요합니다.');
      appendEvent(root, state.issue, { type: 'ADR_CHANGED', issue: state.issue, decision: text, ...bootstrap });
      state.phase = 'READY_TO_IMPLEMENT';
    } else {
      throw new Error(`지원하지 않는 adr action입니다: ${action}`);
    }
  } else if (group === 'pr' && action === 'prepare') {
    const events = readEvents(root, state.issue);
    if (!hasEvent(events, 'PR_REQUESTED')) appendEvent(root, state.issue, { type: 'PR_REQUESTED', issue: state.issue, ...bootstrap });
    const prepared = preparePullRequest({ root, config, state, requireTracked: false });
    saveState(root, state);
    return prepared.bodyPath;
  } else {
    throw new Error(`지원하지 않는 lifecycle 명령입니다: ${group} ${action}`);
  }

  saveState(root, state);
  return 'OK';
}
