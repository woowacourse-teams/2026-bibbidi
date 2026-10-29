import {
  analytics,
  type AnalyticsEvent,
} from "../../../infrastructure/analytics";
import type { BalanceGameQuestion } from "../model/balanceGame";

type Parameters = AnalyticsEvent["parameters"];
export interface GameTrackingSnapshot {
  runId: string;
  answerRevision: number;
  started: boolean;
  cardKey?: string;
  resultId?: string;
}
export interface GameRequest {
  id: string;
  stage: "questions" | "answers" | "recommendations" | "save";
  startedAt: number;
}

function failureKind(cause: unknown): string {
  for (let depth = 0; depth < 5 && cause instanceof Error; depth += 1) {
    if (cause.name === "TimeoutError") return "timeout";
    if (cause instanceof TypeError) return "network";
    if ("status" in cause || "errorCode" in cause) return "api";
    cause = cause.cause;
  }
  return "unknown";
}

export function createBalanceGameTracking({
  authState,
  restored,
  track = analytics.track,
  now = () => performance.now(),
  id = () => crypto.randomUUID(),
}: {
  authState: "guest" | "authenticated";
  restored?: GameTrackingSnapshot;
  track?: (event: AnalyticsEvent) => void;
  now?: () => number;
  id?: () => string;
}) {
  const run = {
    ...restored,
    runId: restored?.runId ?? id(),
    answerRevision: restored?.answerRevision ?? 0,
    started: restored?.started ?? false,
  };
  let cardType: string | undefined;
  let visible = true;
  let question:
    | {
        id: string;
        index: number;
        total: number;
        visitId: string;
        elapsed: number;
        since: number | null;
        closed: boolean;
        changes: number;
      }
    | undefined;
  const selectedQuestions = new Set<string>();
  const emit = (name: string, parameters: Parameters = {}) => {
    try {
      track({
        name,
        parameters: {
          game_run_id: run.runId,
          game_version: "results-v1",
          answer_revision: run.answerRevision,
          auth_state: authState,
          source: "balance_game",
          ...(cardType ? { card_type: cardType } : {}),
          ...parameters,
        },
      });
    } catch {
      /* 계측 실패가 게임 진행·저장을 막지 않는다. */
    }
  };
  const elapsed = () =>
    Math.max(
      0,
      Math.round(
        (question?.elapsed ?? 0) +
          (question?.since !== null && question?.since !== undefined
            ? now() - question.since
            : 0),
      ),
    );
  const pause = () => {
    if (question?.since !== null && question?.since !== undefined) {
      question.elapsed += Math.max(0, now() - question.since);
      question.since = null;
    }
  };
  const resume = () => {
    if (question && !question.closed && question.since === null && visible)
      question.since = now();
  };
  const questionParameters = (): Parameters =>
    question
      ? {
          question_id: question.id,
          question_index: question.index + 1,
          question_count: question.total,
          question_visit_id: question.visitId,
          active_elapsed_ms: elapsed(),
        }
      : {};

  return {
    emit,
    pause,
    resume,
    snapshot: (): GameTrackingSnapshot => ({ ...run }),
    setVisible(next: boolean) {
      pause();
      visible = next;
      resume();
    },
    showQuestion(
      value: BalanceGameQuestion,
      index: number,
      total: number,
      reason: string,
    ) {
      if (question?.id === value.id && !question.closed) {
        resume();
        return;
      }
      pause();
      cardType = undefined;
      question = {
        id: value.id,
        index,
        total,
        visitId: id(),
        elapsed: 0,
        since: visible ? now() : null,
        closed: false,
        changes: 0,
      };
      emit("balance_game_question_view", {
        ...questionParameters(),
        visit_reason: reason,
      });
    },
    select(optionId: string, previous: string | undefined) {
      if (!question || optionId === previous) return;
      run.answerRevision += 1;
      if (!run.started) {
        run.started = true;
        emit("balance_game_start", { question_count: question.total });
      }
      const isChange = previous !== undefined;
      if (isChange) question.changes += 1;
      emit("balance_game_answer_select", {
        ...questionParameters(),
        option_id: optionId,
        is_change: isChange,
        is_first_selection:
          !selectedQuestions.has(question.id) && previous === undefined,
      });
      selectedQuestions.add(question.id);
    },
    next() {
      if (!question || question.closed) return;
      emit("balance_game_question_next", {
        ...questionParameters(),
        answer_change_count: question.changes,
      });
      pause();
      question.closed = true;
    },
    request(
      stage: GameRequest["stage"],
      event?: string,
      parameters: Parameters = {},
    ): GameRequest {
      const request = { id: id(), stage, startedAt: now() };
      if (event) emit(event, { ...parameters, attempt_id: request.id });
      return request;
    },
    duration: (request: GameRequest) =>
      Math.max(0, Math.round(now() - request.startedAt)),
    fail(request: GameRequest, cause: unknown) {
      emit("balance_game_error", {
        stage: request.stage,
        attempt_id: request.id,
        failure_kind: failureKind(cause),
        request_duration_ms: Math.max(0, Math.round(now() - request.startedAt)),
      });
    },
    cardShown(type: string, duration: number, instanceId: string) {
      cardType = type;
      run.resultId = instanceId;
      const key = `${run.answerRevision}:${type}:${instanceId}`;
      if (run.cardKey === key) return;
      run.cardKey = key;
      emit("balance_game_card_view", {
        request_duration_ms: duration,
        recommendation_id: instanceId,
      });
    },
  };
}
export type BalanceGameTracking = ReturnType<typeof createBalanceGameTracking>;
