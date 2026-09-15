import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readEvents } from './events.mjs';
import { changedFiles, snapshotTree, tracked } from './git.mjs';
import { getIssue } from './github.mjs';
import { hasInitialAdr } from './issue.mjs';
import { gitDirectory, run, writeTextAtomic } from './process.mjs';
import { requiredValidations, validationStatus } from './validation.mjs';

function truncate(value, length = 240) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length <= length ? text : `${text.slice(0, length - 1)}…`;
}

function bulletList(values, fallback) {
  return values.length ? values.map((value) => `- ${value}`).join('\n') : `- ${fallback}`;
}

function typeChecklist(files) {
  const docsOnly = files.every((file) => /(?:^docs\/|\.md$)/.test(file));
  return [
    ['Feature', false],
    ['Fix', false],
    ['Hotfix', false],
    ['Chore', !docsOnly],
    ['Docs', docsOnly],
  ].map(([label, checked]) => `- [${checked ? 'x' : ' '}] ${label}`).join('\n');
}

function riskFor(file) {
  if (/hooks|tool-policy|gate|cli\.mjs/.test(file)) return `🔴 \`${file}\` — Lifecycle 차단과 허용 경계를 확인해 주세요.`;
  if (/test|template|skill|convention/.test(file)) return `🟡 \`${file}\` — 요구사항과 검증 범위를 확인해 주세요.`;
  return `🟢 \`${file}\` — 구조와 명명 일관성을 확인해 주세요.`;
}

export function buildPullRequestBody({ root, config, state, files, validations, issueData }) {
  const events = readEvents(root, state.issue);
  const decisions = events
    .filter((event) => event.type === 'GRILL_ME_DECISION')
    .map((event) => truncate(event.decision));
  const prompts = events
    .filter((event) => event.type === 'USER_PROMPTED')
    .slice(-5)
    .map((event) => `사용자: “${truncate(event.prompt, 180)}”`);
  const adrChanges = issueData.comments
    .filter((comment) => /## ADR 변경/.test(comment.body))
    .map((comment, index) => `ADR 변경 #${index + 1}: ${truncate(comment.body, 220)}`);
  const passed = validations.filter((item) => item.passed).map((item) => `\`${item.command}\` — PASSED`);
  const diffStat = run('git', ['diff', '--stat', config.defaultBaseBranch, 'HEAD'], { cwd: root });

  return `## 관련 Issue

- #${state.issue}

## 변경 유형

${typeChecklist(files)}

## 해결한 문제와 변경 이유

- ${issueData.title} 문제를 해결합니다.
  - Coding Agent가 만든 코드와 함께 문제, 설계 결정, 사용자 피드백, 검증 과정을 복원할 수 있게 합니다.

## 변경 사항과 핵심 설계 결정

${bulletList(decisions, 'Issue의 최초 ADR을 기준으로 구현했습니다.')}

<details>
<summary>Diff Stat</summary>

\`\`\`text
${diffStat || '변경 통계가 없습니다.'}
\`\`\`

</details>

## 한계와 Trade-off

- Development Logger 실행을 위해 Node.js 20+가 필요합니다.
- Agent별 Hook payload 차이는 adapter가 흡수하지만 Agent의 Hook 계약 변경 시 fixture와 adapter 갱신이 필요합니다.
- 설치 전 Issue #${state.issue} 기록은 \`bootstrap: true\`로 복원한 기록입니다.

## 기존 기능에 미치는 영향

- 일반 애플리케이션 runtime에는 개입하지 않습니다.
- Coding Agent의 변경 작업과 PR 생성 과정에는 Fail Closed Gate가 적용됩니다.

## Edge Case와 실패 시나리오

- Issue, grill-me, 최초 ADR이 없으면 구현 변경을 차단합니다.
- 필수 검증이 실패했거나 마지막 코드 변경 이후 실행되지 않았으면 PR 생성을 차단합니다.
- 일반 Development Log 실패는 경고하고 PR Gate에서 재검증합니다.

## 검토한 대안과 선택 이유

- Agent transcript 분석 대신 명시적인 lifecycle command를 선택했습니다.
  - 비공개 transcript 형식과 Agent 버전에 대한 결합을 줄입니다.
- Bash·PowerShell 이중 구현 대신 Node.js 공통 core를 선택했습니다.
  - OS별 핵심 로직 중복을 방지합니다.

## 개발 과정

### Grill Me 주요 결정

${bulletList(decisions, '기록된 결정이 없습니다.')}

### 주요 사용자-Agent 대화

${bulletList(prompts, '추가로 요약할 일반 대화가 없습니다.')}

### ADR 변경

${bulletList(adrChanges, '최초 ADR 이후 변경된 결정이 없습니다.')}

## 검증 결과

${bulletList(passed, '통과한 필수 검증이 없습니다.')}

## 리뷰 요청

${bulletList(files.slice(0, 12).map(riskFor), '별도 위험 파일이 없습니다.')}

## 고민 사항

- Hook이 허용하는 조회·검증 명령과 차단하는 변경 명령의 경계가 팀 Workflow에 적절한지 확인해 주세요.
- APP까지 포함한 경로별 검증 선택이 실제 CI 책임과 일치하는지 확인해 주세요.

## Development Log

- \`.devlog/${state.issue}/events.jsonl\`
- \`.devlog/${state.issue}/turn-*.diff\`
`;
}

export function updatePullRequestInput(toolInput, bodyPath) {
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
  return { ...toolInput, [key]: command };
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
