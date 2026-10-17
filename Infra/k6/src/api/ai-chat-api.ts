import type { AiChatClient } from './ai-chat-client.ts';

export interface ChatReply {
  completed: boolean;
  conversationId: string | undefined;
}

export class AiChatApi {
  constructor(
    private readonly client: AiChatClient,
    private readonly token: string,
  ) {}

  ask(message: string, conversationId?: string): ChatReply {
    const result = this.client.call(this.token, message, conversationId);
    return { completed: result.completed, conversationId: result.conversationId };
  }
}
