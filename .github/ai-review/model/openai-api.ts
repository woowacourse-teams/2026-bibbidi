import type { ReviewResult } from "../review/ai-review-types.ts";
import type { ModelRequest, ReviewModel } from "./review-model.ts";
import { reviewOutputSchema } from "./review-output-schema.ts";
import type { RetryingHttp } from "../github/retrying-http.ts";

export class OpenAiApi implements ReviewModel {
  private readonly http: RetryingHttp;
  private readonly apiKey: string;

  constructor(http: RetryingHttp, apiKey: string) {
    this.http = http;
    this.apiKey = apiKey;
  }

  async review({ instructions, input, reasoningEffort, cacheKey }: ModelRequest) {
    const response = await this.http.send("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        instructions,
        input,
        reasoning: { effort: reasoningEffort },
        max_output_tokens: 8_000,
        prompt_cache_key: cacheKey,
        store: false,
        text: {
          verbosity: "low",
          format: { type: "json_schema", name: "code_review_findings", strict: true, schema: reviewOutputSchema },
        },
      }),
    }, "OpenAI API");
    const payload = await response.json();
    const output = payload.output_text
      ?? payload.output
        ?.flatMap((item: { content?: { type: string; text?: string }[] }) => item.content ?? [])
        .filter((item: { type: string }) => item.type === "output_text")
        .map((item: { text?: string }) => item.text)
        .join("");
    if (!output) throw new Error("OpenAI API returned no output text");
    return JSON.parse(output) as ReviewResult;
  }
}
