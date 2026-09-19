import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { hasEvent, readEvents } from './events.ts';
import { changedFiles, snapshotTree, tracked } from './git.ts';
import { getIssue } from './github.ts';
import { hasInitialAdr } from './issue.ts';
import { gitDirectory, writeTextAtomic } from './process.ts';
import { appendTypeLabel, commandKey, labelsFromToolInput, validateTypeLabels } from './type-label.ts';
import { requiredValidations, validationStatus } from './validation.ts';
import type { IssueData, LogEvent, LoggerConfig, SessionState, ToolInput, ValidationStatus } from './types.ts';

const REVIEW_LEVEL = /^\[(?:REQUIRED|CAUTION|ADVICE)\]/;

const VALIDATION_REASONS: Record<string, string> = {
  NOT_RUN: '실행 기록 없음',
  FAILED: '실패',
  STALE: '테스트 뒤에 코드가 바뀜',
};

const REVIEW_DESCRIPTIONS: Record<string, string> = {
  REQUIRED: '합치기 전에 꼭 확인해 주세요. 작업을 막거나 허용하는 규칙이 바뀐 파일입니다.',
  CAUTION: '요구사항과 테스트 범위가 맞는지, 놓친 위험이 없는지 확인해 주세요.',
  ADVICE: '구조나 이름 같은 가벼운 개선 의견이 있으면 알려 주세요.',
};

export type PreparedPullRequest = {
  bodyPath: string;
  files: string[];
  validations: ValidationStatus[];
};

function truncate(value: unknown, length = 240): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length <= length ? text : `${text.slice(0, length - 1)}…`;
}

function bulletList(values: string[], fallback: string): string {
  return values.length ? values.map((value) => `- ${value}`).join('\n') : `- ${fallback}`;
}

function reviewLevel(file: string): string {
  if (/hooks|tool-policy|gate|cli\.(?:mjs|ts)|type-label/.test(file)) return 'REQUIRED';
  if (/test|template|skill|convention|config/.test(file)) return 'CAUTION';
  return 'ADVICE';
}

function reviewRequests(files: string[]): string {
  return ['REQUIRED', 'CAUTION', 'ADVICE'].map((level) => {
    const matched = files.filter((file) => reviewLevel(file) === level);
    if (!matched.length) return null;
    const visible = matched.slice(0, 6).map((file) => `\`${file}\``);
    const omitted = matched.length - visible.length;
    return `- [${level}] ${REVIEW_DESCRIPTIONS[level]}\n  - ${visible.join(', ')}${omitted ? ` 외 ${omitted}개` : ''}`;
  }).filter(Boolean).join('\n');
}

function plannedReviewRequests(plan: LogEvent | undefined): string {
  const review = (plan?.review ?? []) as string[];
  return review
    .map((item) => `- ${REVIEW_LEVEL.test(item) ? item : `[CAUTION] ${item}`}`)
    .join('\n');
}

function finalChanges(events: LogEvent[], plan: LogEvent | undefined, files: string[]): string[] {
  const summary = (plan?.summary ?? []) as string[];
  if (summary.length) return summary.map((item) => truncate(item));
  const decisions = events
    .filter((event) => event.type === 'GRILL_ME_DECISION' && event.decision)
    .slice(-5)
    .map((event) => truncate(event.decision));
  if (!files.length) return decisions;
  const visible = files.slice(0, 5).map((file) => `\`${file}\``);
  const omitted = files.length - visible.length;
  return [...decisions, `변경한 파일: ${visible.join(', ')}${omitted ? ` 외 ${omitted}개` : ''}`];
}

export function buildPullRequestBody({ root, state, files, validations, issueData }: {
  root: string;
  config?: unknown;
  state: Pick<SessionState, 'issue'>;
  files: string[];
  validations: Array<{ command: string; passed: boolean }>;
  issueData: Pick<IssueData, 'title'>;
}): string {
  const issue = state.issue as number;
  const events = readEvents(root, issue);
  const plan = events.findLast((event) => event.type === 'PR_PLANNED');
  const changes = finalChanges(events, plan, files);
  const adrChanges = events
    .filter((event) => event.type === 'ADR_CHANGED' && event.decision)
    .slice(-5)
    .map((event) => truncate(event.decision));
  const passed = validations.filter((item) => item.passed).map((item) => `\`${item.command}\` — PASSED`);

  return `## 관련 Issue

- Closes #${issue}

## 최종 변경 사항

${bulletList(changes, `${issueData.title} 구현을 완료했습니다.`)}

## Issue·ADR 대비 변경

${bulletList(adrChanges, '변경 없음')}

## 검증 결과

${bulletList(passed, '통과한 필수 검증이 없습니다.')}

## 리뷰 요청

${plannedReviewRequests(plan) || reviewRequests(files) || '- [ADVICE] 따로 요청할 리뷰가 없습니다.'}

## Development Log

- \`.devlog/${issue}/events.jsonl\`
- \`.devlog/${issue}/turn-*.diff\`
`;
}

export function updatePullRequestInput(
  toolInput: ToolInput,
  bodyPath: string,
  typeLabel: string | null = null,
  config: { typeLabels?: Record<string, string> } = {},
): ToolInput {
  const key = commandKey(toolInput);
  if (!key) throw new Error('gh pr create 명령 문자열을 찾지 못했습니다.');
  let command = (toolInput[key] as string)
    .replace(/\s+--body-file(?:=|\s+)(?:"[^"]*"|'[^']*'|\S+)/gi, '')
    .replace(/\s+--body(?:=|\s+)(?:"[^"]*"|'[^']*'|\S+)/gi, '')
    .replace(/\s+--fill(?:-first|-verbose)?\b/gi, '');
  const quoted = `"${bodyPath.replace(/"/g, '\\"')}"`;
  command = `${command} --body-file ${quoted}`;
  const updated: ToolInput = { ...toolInput, [key]: command };
  if (!typeLabel) return updated;
  const labels = labelsFromToolInput(updated);
  const existingTypes = labels.filter((label) => /^type\s*:/i.test(label));
  if (existingTypes.length) {
    validateTypeLabels(labels, config, typeLabel);
    return updated;
  }
  return appendTypeLabel(updated, typeLabel);
}

export function assertTemplateStructure(template: string, body: string): void {
  const headings = String(template).match(/^#{2,3}\s+.+$/gm) ?? [];
  const missing = headings.filter((heading) => !body.includes(heading));
  if (missing.length) throw new Error(`PR 본문에 템플릿 제목이 빠졌습니다: ${missing.join(', ')}`);
}

/** grill-me를 건너뛰었거나 ADR 생략을 기록했으면 ADR을 요구하지 않는다. 구현 게이트와 같은 기준이다. */
export function assertPullRequestEvents(events: LogEvent[]): { adrRequired: boolean } {
  const adrSkipped = hasEvent(events, 'ADR_SKIPPED');
  const grillSkipped = hasEvent(events, 'GRILL_ME_SKIPPED') && !hasEvent(events, 'GRILL_ME_FINISHED');
  const design = grillSkipped
    ? ['GRILL_ME_SKIPPED']
    : ['GRILL_ME_STARTED', 'GRILL_ME_QUESTION', 'GRILL_ME_ANSWER', 'GRILL_ME_DECISION', 'GRILL_ME_FINISHED', ...(adrSkipped ? [] : ['ADR_CREATED'])];
  const required = ['SESSION_STARTED', 'ISSUE_BOUND', ...design, 'TURN_FINISHED'];
  const missing = required.filter((type) => !events.some((event) => event.type === type));
  if (missing.length) throw new Error(`작업 기록에 빠진 단계가 있어 PR을 만들 수 없습니다: ${missing.join(', ')}`);

  const lastReopened = events.findLastIndex((event) => event.type === 'ADR_REOPENED');
  const lastChanged = events.findLastIndex((event) => event.type === 'ADR_CHANGED');
  if (lastReopened > lastChanged) throw new Error('다시 논의하기로 한 설계가 아직 정해지지 않았습니다. 정한 결정을 `adr changed`로 기록해 주세요.');

  const lastPlanned = events.findLastIndex((event) => event.type === 'PR_PLANNED');
  const lastConfirmed = events.findLastIndex((event) => event.type === 'COMMIT_CONFIRMED');
  if (lastPlanned < 0) throw new Error('PR에 올릴 내용을 아직 개발자와 정하지 않았습니다. 변경 요약과 리뷰받고 싶은 부분을 하나씩 물어 정한 뒤 `pr plan`으로 기록해 주세요.');
  if (lastPlanned < lastConfirmed) throw new Error('PR 내용을 정한 뒤에 새로 커밋한 코드가 있습니다. PR에 올릴 내용을 다시 정해 `pr plan`으로 기록해 주세요.');
  return { adrRequired: !grillSkipped && !adrSkipped };
}

function assertDevlogCommitted(root: string, issue: number): void {
  const directory = join(root, '.devlog', String(issue));
  if (!existsSync(join(directory, 'events.jsonl'))) {
    throw new Error(`.devlog/${issue}/events.jsonl이 아직 없습니다. 코드를 커밋하면 작업 기록이 함께 내보내집니다.`);
  }
  for (const name of readdirSync(directory)) {
    const path = `.devlog/${issue}/${name}`;
    if (!tracked(root, path)) throw new Error(`${path}가 아직 커밋되지 않았습니다.`);
  }
}

export function preparePullRequest({ root, config, state, requireTracked = true }: {
  root: string;
  config: LoggerConfig;
  state: SessionState;
  requireTracked?: boolean;
}): PreparedPullRequest {
  const issue = state.issue as number;
  const events = readEvents(root, issue);
  const { adrRequired } = assertPullRequestEvents(events);

  const issueData = getIssue(root, config.repository, issue);
  if (adrRequired && !hasInitialAdr(issueData.body)) {
    throw new Error('Issue 본문에 ADR(결정, 이유, 근거, 검증)이 없습니다. ADR이 필요 없다고 정했다면 `adr skip`으로 기록해 주세요.');
  }
  const adrChanged = events.some((event) => event.type === 'ADR_CHANGED');
  if (adrChanged && !(issueData.comments ?? []).some((comment) => /## ADR 변경[\s\S]*### 선택[\s\S]*### 이유/.test(comment.body))) {
    throw new Error('ADR을 바꾼 기록이 있지만 Issue 댓글에 바뀐 선택과 이유가 없습니다. "## ADR 변경" 아래에 "### 선택"과 "### 이유"를 적은 댓글을 남겨 주세요.');
  }

  const files = changedFiles(root, config.defaultBaseBranch);
  const currentTree = snapshotTree(root);
  const required = requiredValidations(config, files);
  const validations = validationStatus(state, required, currentTree);
  const failed = validations.filter((item) => !item.passed);
  if (failed.length) {
    const details = failed.map((item) => `${item.key}(${VALIDATION_REASONS[item.reason] ?? item.reason})`).join(', ');
    throw new Error(`PR 전에 통과해야 하는 테스트가 있습니다: ${details}. 테스트는 백그라운드 실행이나 파이프(|) 없이 돌려야 결과가 기록됩니다.`);
  }

  if (requireTracked) assertDevlogCommitted(root, issue);

  const body = buildPullRequestBody({ root, state, files, validations, issueData });
  const template = readFileSync(join(root, config.pullRequestTemplate as string), 'utf8');
  assertTemplateStructure(template, body);
  const bodyPath = join(gitDirectory(root), 'development-logger', `pr-body-${issue}.md`);
  writeTextAtomic(bodyPath, body);
  return { bodyPath, files, validations };
}
