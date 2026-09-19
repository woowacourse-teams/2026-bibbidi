import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { appendEvent, discardPending, hasEvent, nextTurnNumber, pendingDirectory, readEvents, redactField } from './events.ts';
import { diffStat, diffTrees, gitMetadata, hasCodeChanges, snapshotTree } from './git.ts';
import { getIssue } from './github.ts';
import { extractIssueNumber, hasInitialAdr, hasIssueContent } from './issue.ts';
import { findRepositoryRoot, loadConfig, writeTextAtomic } from './process.ts';
import { assertPullRequestEvents, assertTemplateStructure, preparePullRequest, updatePullRequestInput } from './pr.ts';
import { argumentValues } from './shell.ts';
import { loadState, saveState } from './state.ts';
import { allow, deny, isGitCommit, isIssueCreate, isMutation, isPullRequestCreate, isPullRequestCreateByOtherTool } from './tool-policy.ts';
import { expectedTypeLabel, issueTypeLabel, validateIssueCreateInput } from './type-label.ts';
import { commandFromToolInput, recordValidation } from './validation.ts';
import type { HookOutput, HookPayload, IssueService, LogEvent, LoggerConfig, Phase, SessionState, ToolInput } from './types.ts';
import { messageOf } from './process.ts';

const CLI = 'node --experimental-strip-types packages/development-logger/src/cli.ts';

const PHASE_LABELS: Record<Phase, string> = {
  WAITING_FOR_ISSUE: 'Issue 연결 전',
  RESEARCHING: '조사 중',
  GRILLING: '설계 질문 중',
  GRILL_COMPLETE: '설계 질문 끝(ADR 확인 전)',
  READY_TO_IMPLEMENT: '구현 중',
  ADR_REOPENED: '설계를 다시 논의하는 중',
};

/** Hook은 사용자에게 직접 묻지 못한다. 대신 에이전트에게 무엇을 물을지 지시한다. */
function intentGuide(sessionId: string): string {
  return [
    'Development Logger: 아직 Issue가 연결되지 않았습니다. 코드를 읽고 조사하는 것만 할 수 있습니다.',
    '먼저 사용자에게 무엇을 하고 싶은지 물어 주세요. 답을 받기 전에는 다음 단계로 넘어가지 않습니다.',
    '1. Issue 작성 — 새 Issue를 만든다. 만들기 전에 (가) 이번 작업에 기술 선택이 있을 것 같은지, (나) grill-me로 설계 질문을 시작할지 함께 묻는다.',
    '2. 바로 구현 — 이미 있는 Issue로 작업한다. 번호, URL, 제목 중 하나로 확인한다. 못 찾으면 `gh issue list --state open`으로 열린 Issue를 보여 주고 고르게 한다.',
    '3. 조사만 — Issue 없이 코드를 읽기만 한다.',
    `Issue가 정해지면 기록한다: ${CLI} issue bind --session ${sessionId} --issue <번호>`,
  ].join('\n');
}

function sessionState(root: string, payload: HookPayload, agent: string): SessionState {
  return loadState(root, payload.session_id) ?? {
    sessionId: payload.session_id,
    agent: agent.toUpperCase(),
    cwd: payload.cwd ?? root,
    phase: 'WAITING_FOR_ISSUE',
    validations: {},
  };
}

function eventContext(state: SessionState, suggestion: string | null = null): string {
  if (!state.issue) {
    return [intentGuide(state.sessionId), suggestion].filter(Boolean).join('\n');
  }
  return `Development Logger: Issue #${state.issue} 작업, 지금 단계는 "${PHASE_LABELS[state.phase] ?? state.phase}"입니다. Logger 명령에는 --session ${state.sessionId}를 붙여 주세요.`;
}

function validationResultForTurn(state: SessionState, tree: string): string {
  const values = Object.values(state.validations ?? {}).filter((item) => item.tree === tree);
  if (!values.length) return 'NOT_RUN';
  return values.every((item) => item.passed) ? 'PASSED' : 'FAILED';
}

/**
 * 구현을 막아야 할 이유를 돌려준다. 막을 이유가 없으면 null이고, 그때 phase를 구현 중으로 옮긴다.
 * grill-me를 끝냈으면 ADR을 확인하고, 하지 않았으면 Issue 본문이 설계 합의를 대신한다.
 */
function implementationBlocker(root: string, config: LoggerConfig, state: SessionState, services: IssueService): string | null {
  if (state.phase === 'READY_TO_IMPLEMENT' || state.phase === 'ADR_REOPENED') return null;

  const issue = state.issue as number;
  const events = readEvents(root, issue);
  const mark = state.bootstrap ? { bootstrap: true as const } : {};

  if (hasEvent(events, 'GRILL_ME_FINISHED')) {
    if (!hasEvent(events, 'ADR_SKIPPED')) {
      if (!hasInitialAdr(services.getIssue(root, config.repository, issue).body)) {
        return `설계 질문은 끝났지만 ADR이 아직 없습니다. 기술 선택이 있어 ADR이 필요하다고 정했다면 Issue 본문에 추가하고, 필요 없다고 정했다면 \`${CLI} adr skip --session ${state.sessionId} --text "<이유>"\`로 기록해 주세요.`;
      }
      if (!hasEvent(events, 'ADR_CREATED')) {
        appendEvent(root, issue, { type: 'ADR_CREATED', issue, ...mark });
      }
    }
    state.phase = 'READY_TO_IMPLEMENT';
    return null;
  }

  if (state.phase === 'GRILLING') {
    return `grill-me로 설계 질문을 하는 중입니다. 질문을 끝내고 \`${CLI} grill finish --session ${state.sessionId}\`로 기록한 뒤에 코드를 고쳐 주세요.`;
  }

  if (!hasIssueContent(services.getIssue(root, config.repository, issue).body)) {
    return `Issue #${issue} 본문이 비어 있어 바로 구현할 수 없습니다. 사용자와 grill-me로 설계를 정하거나, 사용자에게 확인받아 Issue 본문을 먼저 채워 주세요.`;
  }
  if (!hasEvent(events, 'GRILL_ME_SKIPPED')) {
    appendEvent(root, issue, { type: 'GRILL_ME_SKIPPED', issue, ...mark });
  }
  state.phase = 'READY_TO_IMPLEMENT';
  return null;
}

/**
 * 코드를 고치지 않고 PR만 만드는 세션은 구현 게이트를 거치지 않아 설계 기록이 남지 않는다.
 * 그때도 Issue 본문에 내용이 있으면 구현 게이트와 똑같이 grill-me를 건너뛴 것으로 기록한다.
 */
function recordDesignSkip(root: string, state: SessionState, issueBody: string): void {
  const issue = state.issue as number;
  const events = readEvents(root, issue);
  if (state.phase === 'GRILLING'
    || hasEvent(events, 'GRILL_ME_FINISHED')
    || hasEvent(events, 'GRILL_ME_SKIPPED')
    || !hasIssueContent(issueBody)) {
    return;
  }
  appendEvent(root, issue, { type: 'GRILL_ME_SKIPPED', issue, ...(state.bootstrap ? { bootstrap: true as const } : {}) });
}

function issueBodyFrom(root: string, toolInput: ToolInput): string | null {
  const command = commandFromToolInput(toolInput);
  const inline = argumentValues(command, 'body', 'b')[0];
  if (inline !== undefined) return inline;
  const file = argumentValues(command, 'body-file', 'F')[0];
  return file ? readFileSync(resolve(root, file), 'utf8') : null;
}

function assertIssueBody(root: string, config: LoggerConfig, toolInput: ToolInput): void {
  if (!config.issueTemplate) return;
  const body = issueBodyFrom(root, toolInput);
  if (body === null) {
    throw new Error(`Issue 본문이 없습니다. \`${config.issueTemplate}\`의 제목을 그대로 쓰고 내용을 채워 --body-file로 넘겨 주세요.`);
  }
  assertTemplateStructure(readFileSync(join(root, config.issueTemplate), 'utf8'), body);
  if (!hasIssueContent(body)) {
    throw new Error('Issue 본문에 템플릿 제목만 있고 내용이 없습니다. 사용자와 정한 내용을 채워 주세요.');
  }
}

function commitProblem(root: string, state: SessionState): string | null {
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

function onSessionStart(root: string, payload: HookPayload, agent: string): HookOutput {
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
  if (state.issue) return {};
  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: intentGuide(state.sessionId),
    },
  };
}

function onUserPrompt(root: string, payload: HookPayload, agent: string): HookOutput {
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

  let suggestion: string | null = null;
  if (!state.issue) {
    const issue = extractIssueNumber(payload.prompt);
    if (issue) {
      suggestion = `이번 요청에 Issue #${issue}가 보입니다. 사용자에게 이 Issue로 시작할지 한 줄로 확인한 뒤 \`${CLI} issue bind --session ${state.sessionId} --issue ${issue}\`로 기록해 주세요. 확인 없이 연결하지 않습니다.`;
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
      additionalContext: eventContext(state, suggestion),
    },
  };
}

function onPostToolUse(root: string, config: LoggerConfig, payload: HookPayload, agent: string): HookOutput {
  const state = sessionState(root, payload, agent);
  let changed = recordValidation(state, config, payload.tool_input, payload.tool_response, root);

  // PR이 실제로 만들어진 뒤에는 아직 내보내지 않은 기록을 버린다. 커밋되지 않은 기록은 남기지 않는다.
  if (state.issue && payload.tool_response !== undefined && isPullRequestCreate(payload.tool_name, payload.tool_input)) {
    discardPending(root, state.issue);
    state.previousTree = snapshotTree(root);
    state.turnStartTree = state.previousTree;
    changed = true;
  }

  if (changed) saveState(root, state);
  return {};
}

function onStop(root: string, payload: HookPayload, agent: string): HookOutput {
  const state = sessionState(root, payload, agent);
  if (!state.issue) return {};
  const turnKey = payload.turn_id ?? state.activeTurnKey ?? String(state.promptCounter ?? 0);
  if (state.lastStoppedTurnKey === turnKey) return {};

  const currentTree = snapshotTree(root);
  const before = state.turnStartTree ?? state.previousTree ?? currentTree;
  const diff = diffTrees(root, before, currentTree);

  const event: LogEvent = { type: 'TURN_FINISHED', turnId: turnKey };
  if (diff) {
    const number = nextTurnNumber(readEvents(root, state.issue));
    const filename = `turn-${String(number).padStart(3, '0')}.diff`;
    writeTextAtomic(join(pendingDirectory(root, state.issue), filename), `${diff}\n`);
    event.diff = filename;
    event.diffStat = diffStat(root, before, currentTree);
    event.testResult = validationResultForTurn(state, currentTree);
  }
  if (state.bootstrap) event.bootstrap = true;
  appendEvent(root, state.issue, event);

  state.previousTree = currentTree;
  state.turnStartTree = currentTree;
  state.lastStoppedTurnKey = turnKey;
  saveState(root, state);
  return {};
}

function onPreToolUse(root: string, config: LoggerConfig, payload: HookPayload, agent: string, services: IssueService): HookOutput {
  const state = sessionState(root, payload, agent);
  const toolName = payload.tool_name;
  const toolInput = payload.tool_input ?? {};

  /** 막은 이유를 작업 기록에도 남긴다. 같은 턴에 같은 이유가 반복되면 한 번만 쌓는다. */
  const denyWith = (reason: string): HookOutput => {
    const signature = `${state.activeTurnKey}|${toolName}|${reason}`;
    if (state.issue && state.lastDenial !== signature) {
      appendEvent(root, state.issue, {
        type: 'TOOL_DENIED',
        issue: state.issue,
        tool: String(toolName ?? ''),
        phase: state.phase,
        turnId: state.activeTurnKey,
        reason: reason.split('\n')[0],
      });
      state.lastDenial = signature;
      saveState(root, state);
    }
    return deny(reason);
  };

  if (isIssueCreate(toolName, toolInput)) {
    try {
      validateIssueCreateInput(toolInput, config);
      assertIssueBody(root, config, toolInput);
      return allow();
    } catch (error) {
      return denyWith(messageOf(error));
    }
  }

  if (isPullRequestCreateByOtherTool(toolName)) {
    return denyWith('PR은 `gh pr create` 명령으로 만들어 주세요. 다른 도구로 만들면 PR 본문, 라벨, 작업 기록 확인을 거치지 않습니다.');
  }

  if (isPullRequestCreate(toolName, toolInput)) {
    if (!state.issue) return denyWith('연결된 Issue가 없어 PR을 만들 수 없습니다.');
    try {
      const issueData = services.getIssue(root, config.repository, state.issue);
      recordDesignSkip(root, state, issueData.body);
      const events = readEvents(root, state.issue);
      assertPullRequestEvents(events);
      if (!hasEvent(events, 'PR_REQUESTED')) {
        appendEvent(root, state.issue, { type: 'PR_REQUESTED', issue: state.issue });
      }
      const typeLabel = expectedTypeLabel(gitMetadata(root).branch, config);
      issueTypeLabel(issueData, config, typeLabel);
      const prepared = preparePullRequest({ root, config, state });
      const dirty = gitMetadata(root).status;
      if (dirty) return denyWith(`커밋하지 않은 변경이 있어 PR을 만들 수 없습니다:\n${dirty}`);
      return allow(updatePullRequestInput(toolInput, prepared.bodyPath, typeLabel, config));
    } catch (error) {
      return denyWith(messageOf(error));
    }
  }

  if (!isMutation(toolName, toolInput, config, state.issue, root)) return allow();
  if (!state.issue) {
    return denyWith('코드를 고치려면 먼저 작업할 GitHub Issue가 연결되어야 합니다. 사용자에게 무엇을 하고 싶은지 묻고, 정해진 Issue를 `issue bind`로 기록해 주세요.');
  }

  let blocker: string | null;
  try {
    blocker = implementationBlocker(root, config, state, services);
  } catch (error) {
    return denyWith(messageOf(error));
  }
  saveState(root, state);
  if (blocker) return denyWith(blocker);

  if (isGitCommit(toolName, toolInput)) {
    const problem = commitProblem(root, state);
    if (problem) return denyWith(problem);
  }
  return allow();
}

/** Codex는 허용 응답에 permissionDecision을 받지 않는다. 보내면 Hook 전체가 실패한다. */
function adaptPreToolUseOutput(agent: string, output: HookOutput): HookOutput {
  const hookOutput = output?.hookSpecificOutput;
  if (agent !== 'codex'
    || hookOutput?.hookEventName !== 'PreToolUse'
    || hookOutput.permissionDecision !== 'allow') {
    return output;
  }

  const { permissionDecision, ...codexHookOutput } = hookOutput;
  void permissionDecision;
  return { ...output, hookSpecificOutput: codexHookOutput };
}

export function handleHook({ agent, payload, cwd = payload.cwd ?? process.cwd(), services = { getIssue } }: {
  agent: string;
  payload: HookPayload;
  cwd?: string;
  services?: IssueService;
}): HookOutput {
  const root = findRepositoryRoot(cwd);
  const config = loadConfig(root);

  switch (payload.hook_event_name) {
    case 'SessionStart':
      return onSessionStart(root, payload, agent);
    case 'UserPromptSubmit':
      return onUserPrompt(root, payload, agent);
    case 'PostToolUse':
      return onPostToolUse(root, config, payload, agent);
    case 'Stop':
      return onStop(root, payload, agent);
    case 'PreToolUse':
      return adaptPreToolUseOutput(agent, onPreToolUse(root, config, payload, agent, services));
    default:
      return {};
  }
}
