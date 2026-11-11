import type { Options } from 'k6/options';
import { AiChatClient } from './src/api/ai-chat-client.ts';
import { Environment, numberFromEnv, textFromEnv } from './src/common/environment.ts';
import { aiThresholds } from './src/config/thresholds.ts';
import { AiMetrics } from './src/metrics/ai-metrics.ts';
import { AiOutcomeReport } from './src/report/ai-report.ts';
import type { SummaryData } from './src/report/summary.ts';
import { GeneralLoad } from './src/scenario/promotion.ts';
import { AiConversationSession } from './src/session/ai-conversation-session.ts';
import type { SetupData } from './src/session/session.ts';

const environment = Environment.fromEnv();

// 모의 모델과 SSE 경로가 살아 있는지 질문 한 대화(기본 3턴)로 확인한다.
const load = new GeneralLoad(
  environment,
  () => ({}),
  new AiChatClient(environment.baseUrl, [new AiMetrics()]),
);
const session = new AiConversationSession({ turns: numberFromEnv('TURNS_PER_CONVERSATION', 3) });

export const options: Options = {
  scenarios: {
    smoke: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: textFromEnv('MAX_DURATION', '5m'),
    },
  },
  thresholds: aiThresholds(),
  summaryTrendStats: ['avg', 'p(95)', 'p(99)', 'max'],
};

export function setup(): SetupData {
  return load.runner().setupRunOnly();
}

export default function (data: SetupData): void {
  load.runner().run(session, data);
}

export function handleSummary(data: SummaryData): Record<string, string> {
  return new AiOutcomeReport(data, 'AI 채팅 스모크').files(textFromEnv('SUMMARY_DIR', '.'));
}
