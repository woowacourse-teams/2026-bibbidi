import type { Session, SessionContext } from './session.ts';
import { think } from './session.ts';
import { AI_USER_ITERATION_OFFSET, UserIds } from './users.ts';

const QUESTIONS = [
  '결혼 준비를 언제부터 시작하면 좋을까요?',
  '웨딩홀 예약은 보통 몇 개월 전에 하나요?',
  '스드메는 어떤 순서로 알아보면 되나요?',
  '예산이 5천만 원인데 항목별로 어떻게 나누면 좋을까요?',
  '신혼여행지는 언제까지 정해야 하나요?',
  '예식 두 달 전에 꼭 해야 할 일이 뭐예요?',
  '청첩장은 언제 맞추고 언제 돌리나요?',
  '혼수는 어떤 것부터 준비해야 하나요?',
  '상견례는 보통 언제 하나요?',
  '하객 수는 어떻게 가늠하고 식사는 어떻게 정하나요?',
];

export interface AiConversationOptions {
  turns: number;
}

// AI: 질문 3턴. 턴 사이에 생각하는 시간을 쉰다. 실패 안내를 받으면 그 대화는 거기서 끝낸다.
export class AiConversationSession implements Session {
  constructor(private readonly options: AiConversationOptions) {}

  run({ data, iteration, apis }: SessionContext): void {
    const chat = apis.chatFor(UserIds.fresh(data.runId, AI_USER_ITERATION_OFFSET + iteration));
    let conversationId: string | undefined;

    for (let turn = 0; turn < this.options.turns; turn += 1) {
      const reply = chat.ask(this.question(), conversationId);
      conversationId = reply.conversationId ?? conversationId;
      if (!reply.completed) {
        break;
      }
      if (turn < this.options.turns - 1) {
        think();
      }
    }
  }

  private question(): string {
    return QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
  }
}
