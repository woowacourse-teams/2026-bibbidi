const findingProperties = {
  kind: { type: "string", enum: ["DEFECT", "QUESTION"] },
  severity: { type: "string", enum: ["REQUIRED", "CAUTION", "ADVICE"] },
  confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
  category: {
    type: "string",
    enum: [
      "#예외처리", "#null-safety", "#트랜잭션", "#모듈경계", "#동시성",
      "#보안", "#성능", "#테스트", "#네이밍", "#질문-토론",
    ],
  },
  path: { type: "string" },
  side: { type: "string", enum: ["LEFT", "RIGHT"] },
  line: { type: "integer", minimum: 1 },
  title: { type: "string" },
  trigger: { type: "string" },
  impact: { type: "string" },
  evidence: { type: "string" },
  explanation: { type: "string" },
  suggestion: { type: "string" },
};

export const reviewOutputSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    aiSufficientChanges: { type: "array", maxItems: 10, items: { type: "string" } },
    humanReviewChanges: { type: "array", maxItems: 10, items: { type: "string" } },
    designQuestions: { type: "array", maxItems: 5, items: { type: "string" } },
    findings: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        properties: findingProperties,
        required: Object.keys(findingProperties),
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "aiSufficientChanges", "humanReviewChanges", "designQuestions", "findings"],
  additionalProperties: false,
};
