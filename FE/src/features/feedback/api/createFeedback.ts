import type { FeedbackSentiment } from "../model/feedback";

const apiBaseUrl = __BIBBIDI_API_BASE_URL__.replace(/\/+$/, "");
const CREATE_FEEDBACK_ENDPOINT = `${apiBaseUrl}/api/feedbacks`;
const CREATE_FEEDBACK_TIMEOUT_MS = 10_000;

export interface CreateFeedbackValues {
  content: string | null;
  sentiment: FeedbackSentiment;
}

export class CreateFeedbackApiError extends Error {
  constructor(readonly status: number) {
    super("피드백 요청을 처리하지 못했습니다.");
    this.name = "CreateFeedbackApiError";
  }
}

export class CreateFeedbackNetworkError extends Error {
  constructor() {
    super("피드백 요청 중 네트워크 오류가 발생했습니다.");
    this.name = "CreateFeedbackNetworkError";
  }
}

export class CreateFeedbackTimeoutError extends Error {
  constructor() {
    super("피드백 요청 시간이 초과됐습니다.");
    this.name = "CreateFeedbackTimeoutError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function createFeedback(
  values: CreateFeedbackValues,
): Promise<void> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    CREATE_FEEDBACK_TIMEOUT_MS,
  );
  let response: Response;

  try {
    response = await fetch(CREATE_FEEDBACK_ENDPOINT, {
      body: JSON.stringify(values),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });
  } catch (error) {
    if (isRecord(error) && error.name === "AbortError") {
      throw new CreateFeedbackTimeoutError();
    }

    throw new CreateFeedbackNetworkError();
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (response.status !== 201) {
    throw new CreateFeedbackApiError(response.status);
  }
}
