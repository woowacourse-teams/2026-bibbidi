import type { Options } from 'k6/options';
import { ApiFactory } from './src/api/api.ts';
import { AiChatClient } from './src/api/ai-chat-client.ts';
import { AiWindowMetrics } from './src/breakpoint/ai-window-metrics.ts';
import { WindowPlan } from './src/breakpoint/windows.ts';
import { Environment, numberFromEnv, textFromEnv } from './src/common/environment.ts';
import { AccessTokenIssuer } from './src/common/token.ts';
import { HttpClient } from './src/http/http.ts';
import { AiSmokeReport } from './src/report/ai-smoke-report.ts';
import type { SummaryData } from './src/report/summary.ts';
import { CallBudget } from './src/scenario/call-budget.ts';
import { LoadTest } from './src/scenario/load-test.ts';
import { AiConversationSession } from './src/session/ai-conversation-session.ts';
import { SessionSequence, type SetupData } from './src/session/session.ts';

const environment = Environment.fromEnv();

const plan = new WindowPlan({ windowSeconds: 600, stepRate: 1, windows: 1 });
const turns = numberFromEnv('TURNS_PER_CONVERSATION', 3);
const session = new AiConversationSession({
  turns,
  thinkSeconds: numberFromEnv('THINK_SECONDS', 3),
  restSeconds: 0,
  budget: new CallBudget(turns, turns),
});

const chatClient = new AiChatClient(environment.baseUrl, [new AiWindowMetrics(plan)]);
const apis = new ApiFactory(new HttpClient(environment.baseUrl), new AccessTokenIssuer(environment), chatClient);
const test = new LoadTest(apis, new SessionSequence([session]), 0);

export const options: Options = {
  scenarios: {
    smoke: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: textFromEnv('MAX_DURATION', '5m'),
    },
  },
  thresholds: {
    'window_ai_completed{window:1}': ['rate==1'],
    'window_ai_server_error{window:1}': ['rate==0'],
    'window_ai_requests{window:1}': ['count>=0'],
    'window_ai_duration{window:1}': ['max>=0'],
    'window_ai_ttft{window:1}': ['max>=0'],
  },
  summaryTrendStats: ['avg', 'p(95)', 'p(99)', 'max'],
};

export function setup(): SetupData {
  return test.setup();
}

export default function (data: SetupData): void {
  test.run(data);
}

export function handleSummary(data: SummaryData): Record<string, string> {
  return new AiSmokeReport(data).files(textFromEnv('SUMMARY_DIR', '.'));
}
