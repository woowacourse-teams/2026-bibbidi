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

// Q4(#538): Bedrock 한도에 닿았을 때 잘 포기하는지 본다. AI 우선순위는 응답이 오는 것이 먼저다.
// 모의 모델의 throttle-ratio(1.0과 0.3)는 params/<회차>.params의 LoadTestThrottleRatio로 정하고,
// 이 스크립트는 SSE 결과를 완료, 실패 안내, 거절, 무응답, 서버 오류로 센다.
//   1.0이면 모든 턴이 구분된 실패 안내로 정해 둔 시간 안에 끝나야 한다.
//   0.3이면 실패하지 않은 턴은 정상 완료되고 실패한 턴은 구분된 안내를 받아야 한다.
// 무응답(disconnected)과 서버 오류(http_error)는 어느 쪽이든 0건이어야 한다.
const environment = Environment.fromEnv();
const load = new GeneralLoad(
  environment,
  () => ({}),
  new AiChatClient(environment.baseUrl, [new AiMetrics()]),
);
const session = new AiConversationSession({ turns: numberFromEnv('TURNS_PER_CONVERSATION', 3) });

export const options: Options = {
  scenarios: {
    ai_throttle: {
      executor: 'constant-vus',
      vus: numberFromEnv('AI_VUS', 10),
      duration: textFromEnv('DURATION', '2m'),
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
  return new AiOutcomeReport(
    data,
    'Q4 AI 한도 초과',
    '모의 모델이 throttle-ratio만큼 한도 초과로 실패시킬 때 구분된 실패 안내로 끝나는지 봅니다.',
  ).files(textFromEnv('SUMMARY_DIR', '.'));
}
