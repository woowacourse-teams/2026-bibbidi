import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readEvents } from './events.mjs';
import { changedFiles, snapshotTree, tracked } from './git.mjs';
import { getIssue } from './github.mjs';
import { hasInitialAdr } from './issue.mjs';
import { gitDirectory, writeTextAtomic } from './process.mjs';
import { appendTypeLabel, labelsFromToolInput, validateTypeLabels } from './type-label.mjs';
import { requiredValidations, validationStatus } from './validation.mjs';

function truncate(value, length = 240) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length <= length ? text : `${text.slice(0, length - 1)}…`;
}

function bulletList(values, fallback) {
  return values.length ? values.map((value) => `- ${value}`).join('\n') : `- ${fallback}`;
}

function reviewLevel(file) {
  if (/hooks|tool-policy|gate|cli\.mjs|type-label/.test(file)) return 'REQUIRED';
  if (/test|template|skill|convention|config/.test(file)) return 'CAUTION';
  return 'ADVICE';
}

function reviewRequests(files) {
  const descriptions = {
    REQUIRED: '병합 전에 Lifecycle 차단·허용 경계와 정책 불변식을 확인해 주세요.',
    CAUTION: '요구사항·검증 범위와 잠재적인 Trade-off를 확인해 주세요.',
    ADVICE: '구조와 명명 등 낮은 위험의 개선 의견을 확인해 주세요.',
  };
  return ['REQUIRED', 'CAUTION', 'ADVICE'].map((level) => {
    const matched = files.filter((file) => reviewLevel(file) === level);
    if (!matched.length) return null;
    const visible = matched.slice(0, 6).map((file) => `\`${file}\``);
    const omitted = matched.length - visible.length;
    return `- [${level}] ${descriptions[level]}\n  - ${visible.join(', ')}${omitted ? ` 외 ${omitted}개` : ''}`;
  }).filter(Boolean).join('\n');
}

export function buildPullRequestBody({ root, config, state, files, validations, issueData }) {
  const events = readEvents(root, state.issue);
  const changes = events
    .filter((event) => event.type === 'TURN_FINISHED' && event.assistantMessage)
    .slice(-3)
    .map((event) => truncate(event.assistantMessage));
  const adrChanges = events
    .filter((event) => event.type === 'ADR_CHANGED' && event.decision)
    .slice(-5)
    .map((event) => truncate(event.decision));
  const passed = validations.filter((item) => item.passed).map((item) => `\`${item.command}\` — PASSED`);

  return `## 관련 Issue

- Closes #${state.issue}

## 최종 변경 사항

${bulletList(changes, `${issueData.title} 구현을 완료했습니다.`)}

## Issue·ADR 대비 변경

${bulletList(adrChanges, '변경 없음')}

## 검증 결과

${bulletList(passed, '통과한 필수 검증이 없습니다.')}

## 리뷰 요청

${reviewRequests(files) || '- [ADVICE] 별도로 요청할 리뷰 항목이 없습니다.'}

## Development Log

- \`.devlog/${state.issue}/events.jsonl\`
- \`.devlog/${state.issue}/turn-*.diff\`
`;
}

export function updatePullRequestInput(toolInput, bodyPath, typeLabel = null, config = {}) {
  const key = Object.hasOwn(toolInput, 'command') ? 'command' : Object.hasOwn(toolInput, 'cmd') ? 'cmd' : null;
  if (!key || typeof toolInput[key] !== 'string') {
    throw new Error('gh pr create 명령의 문자열 입력을 찾지 못했습니다.');
  }
  let command = toolInput[key]
    .replace(/\s+--body-file(?:=|\s+)(?:"[^"]*"|'[^']*'|\S+)/gi, '')
    .replace(/\s+--body(?:=|\s+)(?:"[^"]*"|'[^']*'|\S+)/gi, '')
    .replace(/\s+--fill(?:-first|-verbose)?\b/gi, '');
  const quoted = `"${bodyPath.replace(/"/g, '\\"')}"`;
  command = `${command} --body-file ${quoted}`;
  const updated = { ...toolInput, [key]: command };
  if (!typeLabel) return updated;
  const labels = labelsFromToolInput(updated);
  const existingTypes = labels.filter((label) => /^type\s*:/i.test(label));
  if (existingTypes.length) {
    validateTypeLabels(labels, config, typeLabel);
    return updated;
  }
  return appendTypeLabel(updated, typeLabel);
}

export function assertTemplateStructure(template, body) {
  const headings = String(template).match(/^#{2,3}\s+.+$/gm) ?? [];
  const missing = headings.filter((heading) => !body.includes(heading));
  if (missing.length) throw new Error(`PR Template Section이 누락됐습니다: ${missing.join(', ')}`);
}

export function preparePullRequest({ root, config, state, requireTracked = true }) {
  const events = readEvents(root, state.issue);
  const requiredEvents = ['SESSION_STARTED', 'ISSUE_BOUND', 'GRILL_ME_STARTED', 'GRILL_ME_QUESTION', 'GRILL_ME_ANSWER', 'GRILL_ME_DECISION', 'GRILL_ME_FINISHED', 'ADR_CREATED', 'TURN_FINISHED'];
  const missingEvents = requiredEvents.filter((type) => !events.some((event) => event.type === type));
  if (missingEvents.length) throw new Error(`필수 Event가 없습니다: ${missingEvents.join(', ')}`);
  const lastReopened = events.findLastIndex((event) => event.type === 'ADR_REOPENED');
  const lastChanged = events.findLastIndex((event) => event.type === 'ADR_CHANGED');
  if (lastReopened > lastChanged) throw new Error('다시 열린 ADR이 결정되지 않았습니다.');

  const issueData = getIssue(root, config.repository, state.issue);
  if (!hasInitialAdr(issueData.body)) throw new Error('Issue 본문에 결정·이유·근거·검증을 포함한 최초 ADR이 없습니다.');
  const adrChanged = events.some((event) => event.type === 'ADR_CHANGED');
  if (adrChanged && !issueData.comments.some((comment) => /## ADR 변경[\s\S]*### 선택[\s\S]*### 이유/.test(comment.body))) {
    throw new Error('ADR_CHANGED Event가 있지만 선택과 이유를 포함한 Issue 댓글이 없습니다.');
  }

  const files = changedFiles(root, config.defaultBaseBranch);
  const currentTree = snapshotTree(root);
  const required = requiredValidations(config, files);
  const validations = validationStatus(state, required, currentTree);
  const failed = validations.filter((item) => !item.passed);
  if (failed.length) {
    throw new Error(`필수 검증이 준비되지 않았습니다: ${failed.map((item) => `${item.key}(${item.reason})`).join(', ')}`);
  }

  if (requireTracked) {
    const eventFile = `.devlog/${state.issue}/events.jsonl`;
    if (!tracked(root, eventFile)) throw new Error(`${eventFile}이 Git Commit 대상에 포함되지 않았습니다.`);
    const turnEvents = events.filter((event) => event.type === 'TURN_FINISHED');
    for (const event of turnEvents) {
      const diff = `.devlog/${state.issue}/${event.diff}`;
      if (!tracked(root, diff)) throw new Error(`${diff}가 Git Commit 대상에 포함되지 않았습니다.`);
    }
  }

  const body = buildPullRequestBody({ root, config, state, files, validations, issueData });
  const template = readFileSync(join(root, config.pullRequestTemplate), 'utf8');
  assertTemplateStructure(template, body);
  const bodyPath = join(gitDirectory(root), 'development-logger', `pr-body-${state.issue}.md`);
  writeTextAtomic(bodyPath, body);
  return { bodyPath, files, validations };
}
