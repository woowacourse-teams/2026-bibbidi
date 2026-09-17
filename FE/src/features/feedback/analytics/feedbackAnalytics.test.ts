import { describe, expect, it } from "vitest";

import { createFeedbackSubmitEvent } from "./feedbackAnalytics";

describe("피드백 Analytics 이벤트", () => {
  it("자유 의견과 만족도를 제외하고 고정 유입 위치만 포함한다", () => {
    expect(createFeedbackSubmitEvent()).toEqual({
      name: "feedback_submit",
      parameters: { source: "service_layout" },
    });
  });
});
