import { join } from 'node:path';
import { appendEvent, hasEvent, nextTurnNumber, readEvents, redactField } from './events.mjs';
import { diffStat, diffTrees, gitMetadata, hasCodeChanges, snapshotTree } from './git.mjs';
import { getIssue } from './github.mjs';
import { extractIssueNumber, hasInitialAdr, issueFromCommand } from './issue.mjs';
import { findRepositoryRoot, loadConfig, writeTextAtomic } from './process.mjs';
import { assertPullRequestEvents, preparePullRequest, updatePullRequestInput } from './pr.mjs';
import { loadState, saveState } from './state.mjs';
import { allow, deny, isGitCommit, isIssueCreate, isMutation, isPullRequestCreate, isPullRequestCreateByOtherTool, isShellTool } from './tool-policy.mjs';
import { expectedTypeLabel, issueTypeLabel, validateIssueCreateInput } from './type-label.mjs';
import { commandFromToolInput, recordValidation } from './validation.mjs';

const CLI = 'node packages/development-logger/src/cli.mjs';

const PHASE_LABELS = {
  WAITING_FOR_ISSUE: 'Issue 연결 전',
  RESEARCHING: '조사 중(아직 코드를 고칠 수 없음)',
  GRILLING: '설계 질문 중',
  GRILL_COMPLETE: '설계 질문 끝(ADR 확인 전)',
  READY_TO_IMPLEMENT: '구현 중',
  ADR_REOPENED: '설계를 다시 논의하는 중',
};

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
  if (!state.issue) return 'Development Logger: 아직 작업할 GitHub Issue가 연결되지 않아 코드를 읽고 조사하는 것만 할 수 있습니다.';
  return `Development Logger: Issue #${state.issue} 작업, 지금 단계는 "${PHASE_LABELS[state.phase] ?? state.phase}"입니다. Logger 명령에는 --session ${state.sessionId}를 붙여 주세요.`;
}

function validationResultForTurn(state, tree) {
  const values = Object.values(state.validations ?? {}).filter((item) => item.tree === tree);
  if (!values.length) return 'NOT_RUN';
  return values.every((item) => item.passed) ? 'PASSED' : 'FAILED';
}

function bindIssue(root, config, state, issue, services, source) {
  const issueData = services.getIssue(root, config.repository, issue);
  if (issueData.state !== 'OPEN') throw new Error(`Issue #${issue}가 닫혀 있어 연결할 수 없습니다.`);
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
  appendEvent(root, issue, { type: 'ISSUE_BOUND', issue, source });
}

function bindIssueFromCommand(root, config, state, toolName, toolInput, services) {
  if (state.issue || !isShellTool(toolName)) return false;
  const issue = issueFromCommand(commandFromToolInput(toolInput), config.repository);
  if (!issue) return false;
  try {
    bindIssue(root, config, state, issue, services, 'ISSUE_VIEW_COMMAND');
  } catch {
    return false;
  }
  saveState(root, state);
  return true;
}

function ensureAdrEvent(root, config, state, services) {
  if (!state.issue) return false;
  const events = readEvents(root, state.issue);
  if (!hasEvent(events, 'GRILL_ME_FINISHED')) return false;
  if (!hasEvent(events, 'ADR_SKIPPED')) {
    const issue = services.getIssue(root, config.repository, state.issue);
    if (!hasInitialAdr(issue.body)) return false;
    if (!hasEvent(events, 'ADR_CREATED')) appendEvent(root, state.issue, { type: 'ADR_CREATED', issue: state.issue, ...(state.bootstrap ? { bootstrap: true } : {}) });
  }
  state.phase = 'READY_TO_IMPLEMENT';
  return true;
}

function commitProblem(root, state) {
  const tree = snapshotTree(root);
  if (!hasCodeChanges(root, tree) || state.commitConfirmedTree === tree) return null;
  return [
    '커밋하기 전에 바꾼 내용을 개발자에게 설명하고 확인을 받아 주세요.',
    `1. 무엇을, 왜, 어느 파일에서 바꿨는지 쉬운 말로 설명하고 기록합니다: ${CLI} commit explain --session ${state.sessionId} --text "<설명>"`,
    '2. 개발자에게 이대로 커밋해도 되는지 묻고 답을 기다립니다.',
    `3. 개발자가 확인하면 기록합니다: ${CLI} commit confirm --session ${state.sessionId}`,
    '설명한 뒤 코드가 바뀌면 1번부터 다시 해야 합니다.',
  ].join('\n');
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
    if (issue) bindIssue(root, config, state, issue, services, 'USER_PROMPT');
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
  appendEvent(root, state.issue, {
    type: 'TURN_FINISHED',
    turnId: turnKey,
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
  const { tool_name: toolName, tool_input: toolInput } = payload;

  if (isIssueCreate(toolName, toolInput)) {
    try {
      validateIssueCreateInput(toolInput, config);
      return allow();
    } catch (error) {
      return deny(error.message);
    }
  }

  if (isPullRequestCreateByOtherTool(toolName)) {
    return deny('PR은 `gh pr create` 명령으로 만들어 주세요. 다른 도구로 만들면 PR 본문, 라벨, 작업 기록 확인을 거치지 않습니다.');
  }

  if (isPullRequestCreate(toolName, toolInput)) {
    if (!state.issue) return deny('연결된 Issue가 없어 PR을 만들 수 없습니다.');
    try {
      const events = readEvents(root, state.issue);
      assertPullRequestEvents(events);
      if (!hasEvent(events, 'PR_REQUESTED')) {
        appendEvent(root, state.issue, { type: 'PR_REQUESTED', issue: state.issue });
        return deny(`PR 요청을 기록했습니다. .devlog/${state.issue}/events.jsonl을 커밋한 뒤 다시 PR을 만들어 주세요.`);
      }
      const typeLabel = expectedTypeLabel(gitMetadata(root).branch, config);
      const issueData = services.getIssue(root, config.repository, state.issue);
      issueTypeLabel(issueData, config, typeLabel);
      const prepared = preparePullRequest({ root, config, state });
      const dirty = gitMetadata(root).status;
      if (dirty) return deny(`커밋하지 않은 변경이 있어 PR을 만들 수 없습니다:\n${dirty}`);
      return allow(updatePullRequestInput(toolInput, prepared.bodyPath, typeLabel, config));
    } catch (error) {
      return deny(error.message);
    }
  }

  const context = bindIssueFromCommand(root, config, state, toolName, toolInput, services) ? eventContext(state) : null;
  if (!isMutation(toolName, toolInput, config, state.issue)) return allow(null, context);
  if (!state.issue) return deny('코드를 고치려면 먼저 작업할 GitHub Issue가 연결되어야 합니다. 사용자에게 Issue 번호를 확인하거나 `gh issue view <번호>`로 Issue를 읽어 주세요.');

  try {
    ensureAdrEvent(root, config, state, services);
  } catch (error) {
    return deny(error.message);
  }
  saveState(root, state);
  if (state.phase !== 'READY_TO_IMPLEMENT' && state.phase !== 'ADR_REOPENED') {
    return deny(`아직 코드를 고칠 수 없습니다. 먼저 grill-me로 설계 질문을 끝내 주세요. 기술 선택이 있어 ADR이 필요하다고 정했다면 Issue 본문에 ADR을 추가하고, 필요 없다고 정했다면 \`${CLI} adr skip --session ${state.sessionId} --text "<이유>"\`로 기록해 주세요.`);
  }
  if (isGitCommit(toolName, toolInput)) {
    const problem = commitProblem(root, state);
    if (problem) return deny(problem);
  }
  return allow();
}

function adaptPreToolUseOutput(agent, output) {
  const hookOutput = output?.hookSpecificOutput;
  if (agent !== 'codex'
    || hookOutput?.hookEventName !== 'PreToolUse'
    || hookOutput.permissionDecision !== 'allow') {
    return output;
  }

  const { permissionDecision: ignored, ...codexHookOutput } = hookOutput;
  return {
    ...output,
    hookSpecificOutput: codexHookOutput,
  };
}

export function handleHook({ agent, payload, cwd = payload.cwd ?? process.cwd(), services = { getIssue } }) {
  const root = findRepositoryRoot(cwd);
  const config = loadConfig(root);
  const event = payload.hook_event_name;
  if (event === 'SessionStart') return onSessionStart(root, payload, agent);
  if (event === 'UserPromptSubmit') return onUserPrompt(root, config, payload, agent, services);
  if (event === 'PostToolUse') return onPostToolUse(root, config, payload, agent);
  if (event === 'Stop') return onStop(root, payload, agent);
  if (event === 'PreToolUse') {
    return adaptPreToolUseOutput(agent, onPreToolUse(root, config, payload, agent, services));
  }
  return {};
}
