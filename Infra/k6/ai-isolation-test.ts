import type { Options } from 'k6/options';
import { AiChatClient } from './src/api/ai-chat-client.ts';
import { Environment, numberFromEnv, textFromEnv } from './src/common/environment.ts';
import { ISOLATION, IsolationShape } from './src/config/shape.ts';
import { aiThresholds, generalThresholds, type Thresholds } from './src/config/thresholds.ts';
import { AiMetrics } from './src/metrics/ai-metrics.ts';
import { IsolationReport, ISOLATION_GROUPS } from './src/report/isolation-report.ts';
import type { SummaryData } from './src/report/summary.ts';
import { GeneralLoad, generalScenarios } from './src/scenario/promotion.ts';
import { AiConversationSession } from './src/session/ai-conversation-session.ts';
import type { SetupData } from './src/session/session.ts';

// Q3(#537): AI 대화가 몰려도 일반 API가 멀쩡한지 본다.
// 일반 API를 피크 × 배수로 고정하고, 4분 뒤 AI 동시 대화를 6분 투입한 뒤 2분 관찰한다.
// 일반 API 요청에는 phase(before/during/after)를 붙여 p95를 비교한다. 실제 Bedrock은 부르지 않는다(모의 모델).
const environment = Environment.fromEnv();
const shape = new IsolationShape();
const load = new GeneralLoad(
  environment,
  shape.tags(),
  new AiChatClient(environment.baseUrl, [new AiMetrics()]),
);
const aiSession = new AiConversationSession({ turns: numberFromEnv('TURNS_PER_CONVERSATION', 3) });

// 동시에 열려 있는 AI 대화 수
const AI_VUS = numberFromEnv('AI_VUS', 50);

const thresholds: Thresholds = {
  ...generalThresholds(ISOLATION_GROUPS),
  ...aiThresholds(),
};

export const options: Options = {
  scenarios: {
    ...generalScenarios(shape),
    ai_conversations: {
      executor: 'constant-vus',
      exec: 'aiConversation',
      startTime: `${ISOLATION.beforeSeconds}s`,
      duration: `${ISOLATION.duringSeconds}s`,
      vus: AI_VUS,
    },
  },
  thresholds,
  summaryTrendStats: ['avg', 'p(95)', 'p(99)', 'max'],
};

export function setup(): SetupData {
  return load.setup();
}

export function newUser(data: SetupData): void {
  load.newUser(data);
}

export function returningUser(data: SetupData): void {
  load.returningUser(data);
}

export function catalogBrowse(data: SetupData): void {
  load.catalogBrowse(data);
}

export function tokenRefresh(data: SetupData): void {
  load.tokenRefresh(data);
}

export function aiConversation(data: SetupData): void {
  load.runner().run(aiSession, data);
}

export function handleSummary(data: SummaryData): Record<string, string> {
  return new IsolationReport(data).files(textFromEnv('SUMMARY_DIR', '.'));
}
