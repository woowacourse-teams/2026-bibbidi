import { sleep } from 'k6';
import exec from 'k6/execution';
import type { Options } from 'k6/options';
import { Counter, Trend } from 'k6/metrics';
import { ApiFactory, type CatalogItem } from './src/api/api.ts';
import { AiChatClient } from './src/api/ai-chat-client.ts';
import { Environment, numberFromEnv, textFromEnv } from './src/common/environment.ts';
import { AccessTokenIssuer } from './src/common/token.ts';
import { HttpClient } from './src/http/http.ts';
import type { SummaryData } from './src/report/summary.ts';
import { UserIds } from './src/session/users.ts';

type Cohort = 'new' | 'existing-under-10' | 'existing-10-to-29';
type Turn = '1' | '2' | '3' | '4' | '5b';

interface SetupData {
  runId: number;
  itemTitle: string;
  smallUserIds: number[];
  largeUserIds: number[];
}

const environment = Environment.fromEnv();
const tokens = new AccessTokenIssuer(environment);
const apis = new ApiFactory(new HttpClient(environment.baseUrl), tokens);
const chat = new AiChatClient(environment.baseUrl);
const sessions = numberFromEnv('SESSIONS', 20);
const vus = numberFromEnv('VUS', 1);
const thinkSeconds = numberFromEnv('THINK_SECONDS', 1);

if (!Number.isInteger(sessions) || sessions < 20 || sessions > 50_000 || sessions % 20 !== 0) {
  throw new Error('SESSIONS는 20 이상 50,000 이하의 20의 배수여야 합니다.');
}
if (!Number.isFinite(thinkSeconds) || thinkSeconds < 0) {
  throw new Error('THINK_SECONDS는 0 이상의 숫자여야 합니다.');
}
if (!Number.isInteger(vus) || vus < 1 || vus > sessions) {
  throw new Error('VUS는 1 이상 SESSIONS 이하의 정수여야 합니다.');
}

const weightedTtft = new Trend('scenario_ai_ttft_weighted', true);
const simpleTtft = new Trend('scenario_ai_ttft_simple', true);
const complexTtft = new Trend('scenario_ai_ttft_complex', true);
const completedSessions = new Counter('scenario_ai_ttft_completed_sessions');
const turnTtft: Record<Turn, Trend> = {
  '1': new Trend('scenario_ai_ttft_turn_1', true),
  '2': new Trend('scenario_ai_ttft_turn_2', true),
  '3': new Trend('scenario_ai_ttft_turn_3', true),
  '4': new Trend('scenario_ai_ttft_turn_4', true),
  '5b': new Trend('scenario_ai_ttft_turn_5b', true),
};

export const options: Options = {
  scenarios: {
    ttft: {
      executor: 'shared-iterations',
      vus,
      iterations: sessions,
      maxDuration: textFromEnv('MAX_DURATION', '45m'),
    },
  },
  summaryTrendStats: ['avg', 'p(90)', 'p(99)', 'max'],
  thresholds: {
    scenario_ai_ttft_completed_sessions: [`count>=${sessions}`],
  },
};

export function setup(): SetupData {
  const runId = Math.floor(Date.now() / 1000);
  const catalog = apis.forUser(UserIds.pooled(0)).catalogItems();
  if (catalog.length < 15) {
    throw new Error('체크리스트 15개를 준비하려면 카탈로그 항목이 15개 이상 필요합니다.');
  }
  const item = catalog.find((entry) => entry.title === '웨딩홀 투어')
    ?? catalog.find((entry) => entry.title.includes('웨딩홀'));
  if (item === undefined) {
    throw new Error('카탈로그에서 웨딩홀 관련 질문에 쓸 항목을 찾지 못했습니다.');
  }

  return {
    runId,
    itemTitle: item.title,
    smallUserIds: prepareUsers(runId, catalog, 3, 0),
    largeUserIds: prepareUsers(runId, catalog, 15, 3),
  };
}

function prepareUsers(runId: number, catalog: CatalogItem[], count: number, offset: number): number[] {
  return Array.from({ length: 3 }, (_, index) => {
    const userId = UserIds.fresh(runId, 50_000 + offset + index);
    const api = apis.forUser(userId);
    api.createChecklist();
    api.addCatalogItems(catalog.slice(0, count).map((item) => item.id));
    if (api.findChecklist()?.items.length !== count) {
      throw new Error(`사용자 ${userId}의 체크리스트 ${count}개를 준비하지 못했습니다.`);
    }
    return userId;
  });
}

export default function (data: SetupData): void {
  const iteration = exec.scenario.iterationInTest;
  const slot = iteration % 20;
  const cohort: Cohort = slot < 14 ? 'new' : slot < 17 ? 'existing-under-10' : 'existing-10-to-29';
  const userId = cohort === 'new' ? UserIds.fresh(data.runId, iteration)
    : cohort === 'existing-under-10' ? data.smallUserIds[slot - 14] : data.largeUserIds[slot - 17];
  const checklist = apis.forUser(userId).findChecklist();
  const expectedItems = cohort === 'new' ? 0 : cohort === 'existing-under-10' ? 3 : 15;
  if ((checklist?.items.length ?? 0) !== expectedItems || (cohort === 'new' && checklist !== null)) {
    throw new Error(`${cohort} 사용자의 시작 체크리스트 상태가 다릅니다.`);
  }

  const questions: readonly [Turn, string][] = [
    ['1', '지금 제 결혼 준비 상황을 정리해 주세요.'],
    ['2', '예산이 빠듯한데, 지금 무엇부터 준비하면 좋을까요?'],
    ['3', `${data.itemTitle}가 뭐예요?`],
    ['4', '이걸 왜 지금 해야 하나요?'],
    ['5b', '방금 추천한 항목 체크리스트에 넣어 줘.'],
  ];
  let conversationId: string | undefined;
  for (const [turn, question] of questions) {
    const result = chat.call(tokens.issue(userId), question, conversationId);
    if (result.ttftMs === undefined) {
      throw new Error(`${cohort} ${turn}턴에서 첫 delta를 받지 못했습니다. status=${result.status}`);
    }
    if (!result.completed || result.conversationId === undefined) {
      throw new Error(`${cohort} ${turn}턴의 대화가 완료되지 않았습니다. status=${result.status}`);
    }
    const tags = { cohort, turn };
    weightedTtft.add(result.ttftMs, tags);
    turnTtft[turn].add(result.ttftMs, tags);
    (turn === '1' || turn === '3' || turn === '4' ? simpleTtft : complexTtft).add(result.ttftMs, tags);
    conversationId = result.conversationId;
    if (turn !== '5b') sleep(thinkSeconds);
  }
  completedSessions.add(1);
}

export function handleSummary(data: SummaryData): Record<string, string> {
  const rows: [string, string][] = [
    ['전체(신규 14 : 기존 3 : 기존 3)', 'scenario_ai_ttft_weighted'],
    ['간단한 설명(1·3·4턴)', 'scenario_ai_ttft_simple'],
    ['복잡한 추천·조작 지시(2·5-b턴)', 'scenario_ai_ttft_complex'],
    ['1턴', 'scenario_ai_ttft_turn_1'],
    ['2턴', 'scenario_ai_ttft_turn_2'],
    ['3턴', 'scenario_ai_ttft_turn_3'],
    ['4턴', 'scenario_ai_ttft_turn_4'],
    ['5-b턴', 'scenario_ai_ttft_turn_5b'],
  ];
  const value = (name: string, stat: string): string => {
    const milliseconds = data.metrics?.[name]?.values?.[stat];
    return milliseconds === undefined ? '-' : (milliseconds / 1000).toFixed(2);
  };
  const markdown = [
    '## AI 챗봇 TTFT 측정',
    '',
    '요청을 보낸 시점부터 첫 delta 이벤트가 k6에 도착할 때까지를 측정합니다. 단위는 초입니다.',
    '20세션마다 신규 14명, 체크리스트 3개 사용자 3명, 15개 사용자 3명을 사용합니다. 각 세션은 1·2·3·4·5-b턴을 실행합니다.',
    `완료한 세션: ${data.metrics?.scenario_ai_ttft_completed_sessions?.values?.count ?? 0}/${sessions}`,
    '',
    '| 구분 | p90 | p99 | 평균 |',
    '| --- | ---: | ---: | ---: |',
    ...rows.map(([label, metric]) => `| ${label} | ${value(metric, 'p(90)')} | ${value(metric, 'p(99)')} | ${value(metric, 'avg')} |`),
    '',
    '임시 기준은 합격 조건으로 적용하지 않았습니다. 첫 측정 결과를 보고 조정합니다.',
    '',
  ].join('\n');
  const directory = textFromEnv('SUMMARY_DIR', '.');
  return {
    [`${directory}/summary.json`]: JSON.stringify(data, null, 2),
    [`${directory}/report.md`]: markdown,
    stdout: markdown,
  };
}
