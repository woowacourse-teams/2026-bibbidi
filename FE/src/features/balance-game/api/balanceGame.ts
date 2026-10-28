import { authenticatedFetch } from "../../../infrastructure/http/authenticatedFetch";
import type {
  BalanceGameAnswer,
  BalanceGameOption,
  BalanceGameQuestion,
  BalanceGameRecommendation,
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

function isId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isOption(value: unknown): value is BalanceGameOption {
  return (
    isRecord(value) &&
    ["A", "B", "UNKNOWN"].includes(String(value.id)) &&
    typeof value.text === "string" &&
    (value.imagePath === null ||
      (typeof value.imagePath === "string" &&
        /^\/balance-game\/[\w-]+\.webp$/.test(value.imagePath)))
  );
}

export function parseQuestions(value: unknown): BalanceGameQuestion[] {
  if (
    !isRecord(value) ||
    !Array.isArray(value.questions) ||
    !value.questions.every(
      (question): question is BalanceGameQuestion =>
        isRecord(question) &&
        isId(question.id) &&
        isId(question.order) &&
        typeof question.question === "string" &&
        Array.isArray(question.options) &&
        question.options.every(isOption) &&
        question.options.length === 3 &&
        new Set(question.options.map((option) => option.id)).size === 3,
    )
  ) {
    throw new Error("밸런스게임 문항 응답 형식이 올바르지 않습니다.");
  }
  const questions = value.questions;
  if (
    new Set(questions.map((question) => question.id)).size !==
      questions.length ||
    new Set(questions.map((question) => question.order)).size !==
      questions.length
  ) {
    throw new Error("밸런스게임 문항이 중복되었습니다.");
  }
  return [...questions].sort((a, b) => a.order - b.order);
}

export function parseRecommendations(
  value: unknown,
): BalanceGameRecommendation[] {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !value.items.every(
      (item): item is BalanceGameRecommendation =>
        isRecord(item) &&
        isId(item.catalogItemId) &&
        typeof item.title === "string" &&
        typeof item.categoryName === "string" &&
        Number.isSafeInteger(item.phase) &&
        typeof item.stepName === "string",
    )
  ) {
    throw new Error("밸런스게임 추천 응답 형식이 올바르지 않습니다.");
  }
  return [
    ...new Map(value.items.map((item) => [item.catalogItemId, item])).values(),
  ];
}

async function request(path: string, init: RequestInit, signal: AbortSignal) {
  const timeout = AbortSignal.timeout(15_000);
  const response = await authenticatedFetch(`${endpoint}/${path}`, {
    ...init,
    credentials: "include",
    signal: AbortSignal.any([signal, timeout]),
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

export async function getBalanceGameRecommendations(
  answers: BalanceGameAnswer[],
  signal: AbortSignal,
) {
  return parseRecommendations(
    await request(
      "recommendations",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      },
      signal,
    ),
  );
}
