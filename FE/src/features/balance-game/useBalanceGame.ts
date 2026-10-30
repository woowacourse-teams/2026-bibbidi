import { useCallback, useEffect, useRef, useState } from "react";
import {
  BalanceGameApiError,
  getBalanceGameQuestions,
  getBalanceGameResult,
} from "./api/balanceGame";
import { createBalanceGameTracking } from "./analytics/balanceGameTracking";
import type {
  BalanceGameAnswer,
  BalanceGameQuestion,
  BalanceGameResult,
} from "./model/balanceGame";
import {
  clearBalanceGameDraft,
  writeBalanceGameDraft,
  type BalanceGameDraft,
} from "./model/balanceGameDraft";

type GameState =
  | { status: "loading" | "empty" }
  | { status: "error"; message: string }
  | { status: "playing"; questions: BalanceGameQuestion[] }
  | {
      status: "result";
      result: BalanceGameResult;
      requestDurationMs: number;
      instanceId: string;
      selectedIds?: number[];
    };

export function useBalanceGame(
  audience: "guest" | "authenticated",
  draft?: BalanceGameDraft,
) {
  const [tracking] = useState(() =>
    createBalanceGameTracking({
      authState: audience,
      restored: draft?.tracking,
    }),
  );
  const [state, setState] = useState<GameState>(() =>
    draft
      ? {
          status: "result",
          result: draft.result,
          instanceId: draft.tracking.resultId ?? crypto.randomUUID(),
          requestDurationMs: 0,
          selectedIds: draft.selectedIds,
        }
      : { status: "loading" },
  );
  const [revision, setRevision] = useState(0);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<BalanceGameAnswer[]>(
    draft?.answers ?? [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => {
    const updateVisibility = () =>
      tracking.setVisible(
        document.visibilityState === "visible" && document.hasFocus(),
      );
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    window.addEventListener("focus", updateVisibility);
    window.addEventListener("blur", updateVisibility);
    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
      window.removeEventListener("focus", updateVisibility);
      window.removeEventListener("blur", updateVisibility);
      tracking.pause();
    };
  }, [tracking]);

  useEffect(() => {
    if (draft) return;
    const controller = new AbortController();
    const request = tracking.request("questions");
    getBalanceGameQuestions(controller.signal).then(
      (questions) => {
        if (controller.signal.aborted) return;
        setState(
          questions.length
            ? { status: "playing", questions }
            : { status: "empty" },
        );
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        tracking.fail(request, cause);
        setState({
          status: "error",
          message:
            cause instanceof BalanceGameApiError
              ? cause.message
              : "질문을 불러오지 못했어요. 다시 시도해 주세요.",
        });
      },
    );
    return () => controller.abort();
  }, [revision, draft, tracking]);

  useEffect(
    () => () => {
      pending.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (state.status === "playing" && state.questions[index])
      tracking.showQuestion(
        state.questions[index],
        index,
        state.questions.length,
        index === 0 ? "initial" : "next",
      );
    if (state.status === "result" && audience === "authenticated")
      clearBalanceGameDraft();
  }, [state, index, tracking, audience]);

  const question =
    state.status === "playing" ? state.questions[index] : undefined;
  const selected = answers.find(
    (answer) => answer.questionId === question?.id,
  )?.optionId;
  const submit = async (submittedAnswers: BalanceGameAnswer[]) => {
    if (state.status !== "playing" || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setSubmitting(true);
    setError(null);
    const request = tracking.request("answers", "balance_game_answer_submit", {
      question_count: state.questions.length,
      answered_count: submittedAnswers.filter((a) => a.optionId !== "UNKNOWN")
        .length,
    });
    try {
      const result = await getBalanceGameResult(
        submittedAnswers,
        controller.signal,
      );
      if (!controller.signal.aborted)
        setState({
          status: "result",
          result,
          instanceId: request.id,
          requestDurationMs: tracking.duration(request),
        });
    } catch (cause) {
      if (!controller.signal.aborted) {
        tracking.fail(request, cause);
        tracking.showQuestion(
          state.questions[index],
          index,
          state.questions.length,
          "retry",
        );
        setError(
          cause instanceof BalanceGameApiError
            ? cause.message
            : "결과를 불러오지 못했어요. 답변은 유지되니 다시 시도해 주세요.",
        );
      }
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        if (!controller.signal.aborted) setSubmitting(false);
      }
    }
  };

  const rememberForLogin = useCallback(
    (selectedIds: number[]) =>
      state.status === "result" &&
      writeBalanceGameDraft({
        result: state.result,
        answers,
        selectedIds,
        tracking: tracking.snapshot(),
      }),
    [state, answers, tracking],
  );

  return {
    state,
    question,
    index,
    selected,
    submitting,
    error,
    tracking,
    retry: () => {
      setState({ status: "loading" });
      setRevision((value) => value + 1);
    },
    select: (optionId: BalanceGameAnswer["optionId"]) => {
      if (
        state.status !== "playing" ||
        !question ||
        pending.current ||
        !question.options.some((option) => option.id === optionId)
      )
        return;
      tracking.select(optionId, selected);
      const nextAnswers = [
        ...answers.filter((answer) => answer.questionId !== question.id),
        { questionId: question.id, optionId },
      ];
      setAnswers(nextAnswers);
      setError(null);
      if (
        index === state.questions.length - 1 &&
        !nextAnswers.some((a) => a.optionId !== "UNKNOWN")
      ) {
        setError("결과를 보려면 한 개 이상의 질문에 답을 골라주세요.");
        return;
      }
      tracking.next();
      if (index === state.questions.length - 1) void submit(nextAnswers);
      else setIndex(index + 1);
    },
    rememberForLogin,
  };
}
