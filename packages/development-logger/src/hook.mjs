import { join } from 'node:path';
import { appendEvent, hasEvent, nextTurnNumber, readEvents, redactField } from './events.mjs';
import { diffStat, diffTrees, gitMetadata, snapshotTree } from './git.mjs';
import { getIssue } from './github.mjs';
import { extractIssueNumber, hasInitialAdr } from './issue.mjs';
import { findRepositoryRoot, loadConfig, writeTextAtomic } from './process.mjs';
import { preparePullRequest, updatePullRequestInput } from './pr.mjs';
import { loadState, saveState } from './state.mjs';
import { allow, deny, isMutation, isPullRequestCreate } from './tool-policy.mjs';
import { recordValidation } from './validation.mjs';

function sessionState(root, payload, agent) {
  return loadState(root, payload.session_id) ?? {
    sessionId: payload.session_id,
    agent: agent.toUpperCase(),
    cwd: payload.cwd ?? root,
    phase: 'WAITING_FOR_ISSUE',
    validations: {},
  };
}

function eventContext(state) {
  if (!state.issue) return 'GitHub Issue ID가 연결되기 전에는 조회와 조사만 수행할 수 있습니다.';
  return `Development Logger session=${state.sessionId}, issue=#${state.issue}, phase=${state.phase}. 설계 인터뷰에서는 Logger CLI에 --session ${state.sessionId}를 전달하세요.`;
}

function validationResultForTurn(state, tree) {
  const values = Object.values(state.validations ?? {}).filter((item) => item.tree === tree);
  if (!values.length) return 'NOT_RUN';
  return values.every((item) => item.passed) ? 'PASSED' : 'FAILED';
}

function ensureAdrEvent(root, config, state, services) {
  if (!state.issue) return false;
  const events = readEvents(root, state.issue);
  if (!hasEvent(events, 'GRILL_ME_FINISHED')) return false;
  const issue = services.getIssue(root, config.repository, state.issue);
  if (!hasInitialAdr(issue.body)) return false;
  if (!hasEvent(events, 'ADR_CREATED')) appendEvent(root, state.issue, { type: 'ADR_CREATED', issue: state.issue, ...(state.bootstrap ? { bootstrap: true } : {}) });
  state.phase = 'READY_TO_IMPLEMENT';
  return true;
}

function onSessionStart(root, payload, agent) {
  const state = sessionState(root, payload, agent);
  const metadata = gitMetadata(root);
  Object.assign(state, {
    source: payload.source ?? 'startup',
    branch: metadata.branch,
    head: metadata.head,
    initialStatus: metadata.status,
    previousTree: snapshotTree(root),
    startedAt: state.startedAt ?? new Date().toISOString(),
  });
  saveState(root, state);
  return {};
}

function onUserPrompt(root, config, payload, agent, services) {
  const state = sessionState(root, payload, agent);
  if (!state.head) {
    const metadata = gitMetadata(root);
    state.branch = metadata.branch;
    state.head = metadata.head;
    state.initialStatus = metadata.status;
    state.startedAt = new Date().toISOString();
  }
  state.previousTree ??= snapshotTree(root);
  state.promptCounter = (state.promptCounter ?? 0) + 1;
  state.activeTurnKey = payload.turn_id ?? String(state.promptCounter);
  state.turnStartTree = state.previousTree;

  if (!state.issue) {
    const issue = extractIssueNumber(payload.prompt);
    if (issue) {
      const issueData = services.getIssue(root, config.repository, issue);
      if (issueData.state !== 'OPEN') throw new Error(`Issue #${issue}가 열려 있지 않습니다.`);
      state.issue = issue;
      state.issueRead = true;
      state.phase = 'RESEARCHING';
      appendEvent(root, issue, {
        type: 'SESSION_STARTED',
        sessionId: state.sessionId,
        agent: state.agent,
        cwd: state.cwd,
        branch: state.branch,
        head: state.head,
        gitStatus: state.initialStatus,
      });
      appendEvent(root, issue, { type: 'ISSUE_BOUND', issue });
    }
  }

  if (state.issue) {
    const prompt = redactField(payload.prompt);
    appendEvent(root, state.issue, state.phase === 'GRILLING'
      ? { type: 'GRILL_ME_ANSWER', issue: state.issue, turnId: state.activeTurnKey, answer: prompt.text, redacted: prompt.redacted }
      : { type: 'USER_PROMPTED', issue: state.issue, turnId: state.activeTurnKey, prompt: prompt.text, redacted: prompt.redacted });
  }

  saveState(root, state);
  return {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: eventContext(state),
    },
  };
}

function onPostToolUse(root, config, payload, agent) {
  const state = sessionState(root, payload, agent);
  if (recordValidation(state, config, payload.tool_input, payload.tool_response, root)) saveState(root, state);
  return {};
}

function onStop(root, payload, agent) {
  const state = sessionState(root, payload, agent);
  if (!state.issue) return {};
  const turnKey = payload.turn_id ?? state.activeTurnKey ?? String(state.promptCounter ?? 0);
  if (state.lastStoppedTurnKey === turnKey) return {};

  const events = readEvents(root, state.issue);
  const number = nextTurnNumber(events);
  const currentTree = snapshotTree(root);
  const before = state.turnStartTree ?? state.previousTree ?? currentTree;
  const diff = diffTrees(root, before, currentTree);
  const filename = `turn-${String(number).padStart(3, '0')}.diff`;
  writeTextAtomic(join(root, '.devlog', String(state.issue), filename), diff ? `${diff}\n` : '');
  const assistant = redactField(payload.last_assistant_message ?? '');
  appendEvent(root, state.issue, {
    type: 'TURN_FINISHED',
    turnId: turnKey,
    assistantMessage: assistant.text,
    redacted: assistant.redacted,
    diff: filename,
    diffStat: diffStat(root, before, currentTree),
    testResult: validationResultForTurn(state, currentTree),
    ...(state.bootstrap ? { bootstrap: true } : {}),
  });
  state.previousTree = currentTree;
  state.turnStartTree = currentTree;
  state.lastStoppedTurnKey = turnKey;
  saveState(root, state);
  return {};
}

function onPreToolUse(root, config, payload, agent, services) {
  const state = sessionState(root, payload, agent);
  const prRequested = isPullRequestCreate(payload.tool_name, payload.tool_input);

  if (prRequested) {
    if (!state.issue) return deny('GitHub Issue가 연결되지 않아 PR을 생성할 수 없습니다.');
    const events = readEvents(root, state.issue);
    if (!hasEvent(events, 'PR_REQUESTED')) {
      appendEvent(root, state.issue, { type: 'PR_REQUESTED', issue: state.issue });
      return deny(`PR_REQUESTED를 기록했습니다. .devlog/${state.issue}/events.jsonl을 Commit한 뒤 다시 PR을 생성하세요.`);
    }
    try {
      const prepared = preparePullRequest({ root, config, state });
      const dirty = gitMetadata(root).status;
      if (dirty) return deny(`Commit되지 않은 변경이 있어 PR을 생성할 수 없습니다:\n${dirty}`);
      return allow(updatePullRequestInput(payload.tool_input, prepared.bodyPath));
    } catch (error) {
      return deny(error.message);
    }
  }

  if (!isMutation(payload.tool_name, payload.tool_input, config, state.issue)) return allow();
  if (!state.issue) return deny('GitHub Issue ID를 먼저 제공하고 Issue를 조사해야 합니다.');

  try {
    ensureAdrEvent(root, config, state, services);
  } catch (error) {
    return deny(error.message);
  }
  saveState(root, state);
  if (state.phase !== 'READY_TO_IMPLEMENT' && state.phase !== 'ADR_REOPENED') {
    return deny('구현 Gate가 닫혀 있습니다. grill-me를 완료하고 Issue 본문에 최초 ADR과 검증 계획을 기록하세요.');
  }
  return allow();
}

export function handleHook({ agent, payload, cwd = payload.cwd ?? process.cwd(), services = { getIssue } }) {
  const root = findRepositoryRoot(cwd);
  const config = loadConfig(root);
  const event = payload.hook_event_name;
  if (event === 'SessionStart') return onSessionStart(root, payload, agent);
  if (event === 'UserPromptSubmit') return onUserPrompt(root, config, payload, agent, services);
  if (event === 'PostToolUse') return onPostToolUse(root, config, payload, agent);
  if (event === 'Stop') return onStop(root, payload, agent);
  if (event === 'PreToolUse') return onPreToolUse(root, config, payload, agent, services);
  return {};
}
