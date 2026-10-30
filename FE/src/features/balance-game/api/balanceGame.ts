import type {
  BalanceGameAnswer,
  BalanceGameQuestion,
  BalanceGameResult,
} from "../model/balanceGame";

const endpoint = `${__BIBBIDI_API_BASE_URL__.replace(/\/+$/, "")}/api/balance-game`;

export class BalanceGameApiError extends Error {
  constructor(
    readonly status: number,
    readonly errorCode: number,
    message: string,
  ) {
    super(message);
    this.name = "BalanceGameApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isContentId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

function isImageUrl(value: string): boolean {
  return !value || /^https?:\/\//.test(value) || /^\/(?!\/)/.test(value);
}

export function parseQuestions(value: unknown): BalanceGameQuestion[] {
  if (!isRecord(value) || !Array.isArray(value.questions))
    throw new Error("밸런스게임 문항 응답 형식이 올바르지 않습니다.");
  const questions = value.questions.map((question, index) => {
    if (
      !isRecord(question) ||
      !isContentId(question.id) ||
      typeof question.text !== "string" ||
      !Array.isArray(question.options) ||
      question.options.length !== 2 ||
      !question.options.every(
        (option) =>
          isRecord(option) &&
          isContentId(option.id) &&
          option.id !== "UNKNOWN" &&
          typeof option.text === "string" &&
          typeof option.imageUrl === "string" &&
          isImageUrl(option.imageUrl),
      ) ||
      new Set(question.options.map((option) => option.id)).size !== 2
    )
      throw new Error("밸런스게임 문항 응답 형식이 올바르지 않습니다.");
    return {
      id: question.id,
      order: index + 1,
      question: question.text,
      options: [
        ...question.options.map((option) => ({
          id: option.id as string,
          text: option.text as string,
          imagePath: option.imageUrl as string,
        })),
        { id: "UNKNOWN" as const, text: "아직 잘 모르겠어", imagePath: null },
      ],
    };
  });
  if (
    new Set(questions.map((question) => question.id)).size !== questions.length
  )
    throw new Error("밸런스게임 문항이 중복되었습니다.");
  return questions;
}

export function parseResult(value: unknown): BalanceGameResult {
  if (
    !isRecord(value) ||
    !isContentId(value.id) ||
    typeof value.name !== "string" ||
    typeof value.summary !== "string" ||
    typeof value.imageUrl !== "string" ||
    !Array.isArray(value.catalogItemIds) ||
    !value.catalogItemIds.every(
      (id) => typeof id === "number" && Number.isSafeInteger(id) && id > 0,
    )
  )
    throw new Error("밸런스게임 결과 응답 형식이 올바르지 않습니다.");
  if (!isImageUrl(value.imageUrl))
    throw new Error("밸런스게임 이미지 주소가 올바르지 않습니다.");
  return {
    id: value.id,
    name: value.name,
    summary: value.summary,
    imageUrl: value.imageUrl,
    catalogItemIds: [...new Set(value.catalogItemIds as number[])],
  };
}

async function request(path: string, init: RequestInit, signal: AbortSignal) {
  const response = await fetch(`${endpoint}/${path}`, {
    ...init,
    credentials: "omit",
    signal: AbortSignal.any([
      signal,
      AbortSignal.timeout(path === "results" ? 30_000 : 15_000),
    ]),
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new BalanceGameApiError(
      response.status,
      isRecord(body) && typeof body.errorCode === "number" ? body.errorCode : 0,
      isRecord(body) &&
        typeof body.message === "string" &&
        response.status < 500
        ? body.message
        : "요청을 처리하지 못했어요. 다시 시도해 주세요.",
    );
  }
  return response.json() as Promise<unknown>;
}

export async function getBalanceGameQuestions(signal: AbortSignal) {
  return parseQuestions(await request("questions", { method: "GET" }, signal));
}

export async function getBalanceGameResult(
  answers: BalanceGameAnswer[],
  signal: AbortSignal,
) {
  return parseResult(
    await request(
      "results",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: Object.fromEntries(
            answers
              .filter((answer) => answer.optionId !== "UNKNOWN")
              .map((answer) => [answer.questionId, answer.optionId]),
          ),
        }),
      },
      signal,
    ),
  );
}
