import type { BotUser } from "../review/ai-review-types.ts";

export class BotAuthor {
  private readonly user: BotUser | undefined;

  constructor(user: BotUser | undefined) {
    this.user = user;
  }

  isBot() {
    return this.user?.login === "github-actions[bot]" || this.user?.type === "Bot";
  }
}
