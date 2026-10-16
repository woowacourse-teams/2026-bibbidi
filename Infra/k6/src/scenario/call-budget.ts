import exec from 'k6/execution';
import { Counter } from 'k6/metrics';

export const callBudgetExhausted = new Counter('ai_call_budget_exhausted');

export class CallBudget {
  constructor(
    private readonly maxCalls: number,
    private readonly callsPerConversation: number,
  ) {}

  get limit(): number {
    return this.maxCalls;
  }

  available(conversationIndex: number): boolean {
    if (conversationIndex * this.callsPerConversation < this.maxCalls) {
      return true;
    }

    callBudgetExhausted.add(1);
    exec.test.abort(`AI 호출 ${this.maxCalls}건 상한에 닿아 중단했습니다.`);
    return false;
  }
}
