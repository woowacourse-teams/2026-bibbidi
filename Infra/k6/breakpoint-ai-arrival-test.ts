import type { Options } from 'k6/options';
import { ApiFactory } from './src/api/api.ts';
import { AiChatClient } from './src/api/ai-chat-client.ts';
import { AiBreakpointReport } from './src/breakpoint/ai-breakpoint-report.ts';
import { AiWindowMetrics } from './src/breakpoint/ai-window-metrics.ts';
import { aiRules } from './src/breakpoint/window-rules.ts';
import { WindowPlan } from './src/breakpoint/windows.ts';
import { Environment, numberFromEnv, textFromEnv } from './src/common/environment.ts';
import { AccessTokenIssuer } from './src/common/token.ts';
import { HttpClient } from './src/http/http.ts';
import type { SummaryData } from './src/report/summary.ts';
import { CallBudget } from './src/scenario/call-budget.ts';
import { LoadTest } from './src/scenario/load-test.ts';
import { AiConversationSession } from './src/session/ai-conversation-session.ts';
import { SessionSequence, type SetupData } from './src/session/session.ts';

const environment = Environment.fromEnv();

const windowSeconds = numberFromEnv('WINDOW_SECONDS', 60);
const plan = new WindowPlan({
  windowSeconds,
  stepRate: numberFromEnv('STEP_RATE', 5),
  windows: numberFromEnv('WINDOWS', 20),
  unitSeconds: 10,
});

const turns = numberFromEnv('TURNS_PER_CONVERSATION', 3);
const budget = new CallBudget(numberFromEnv('MAX_TOTAL_CALLS', 1000), turns);
const session = new AiConversationSession({
  turns,
  thinkSeconds: numberFromEnv('THINK_SECONDS', 3),
  restSeconds: 0,
  budget,
});

const chatClient = new AiChatClient(environment.baseUrl, [new AiWindowMetrics(plan)]);
const apis = new ApiFactory(new HttpClient(environment.baseUrl), new AccessTokenIssuer(environment), chatClient);
const test = new LoadTest(apis, new SessionSequence([session]), 0);

const expectedConversationSeconds = numberFromEnv('EXPECTED_CONVERSATION_SECONDS', 60);
const preAllocatedVUs = numberFromEnv(
  'PRE_ALLOCATED_VUS',
  Math.ceil(plan.perSecond(plan.windows) * expectedConversationSeconds),
);

export const options: Options = {
  scenarios: {
    breakpoint: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: `${plan.unitSeconds}s`,
      preAllocatedVUs,
      maxVUs: numberFromEnv('MAX_VUS', preAllocatedVUs * 2),
      stages: plan.stages(),
      gracefulStop: '75s',
    },
  },
  thresholds: plan.thresholds(aiRules(numberFromEnv('EVAL_DELAY_SECONDS', windowSeconds + 60), true)),
  summaryTrendStats: ['avg', 'p(95)', 'p(99)', 'max'],
};

export function setup(): SetupData {
  return test.setup();
}

export default function (data: SetupData): void {
  test.run(data);
}

export function handleSummary(data: SummaryData): Record<string, string> {
  return new AiBreakpointReport(data, plan, {
    describeLoad: (perSecond) => `초당 ${Number(perSecond.toFixed(2))}건의 대화 시작`,
    maxCalls: budget.limit,
  }).files(textFromEnv('SUMMARY_DIR', '.'));
}
