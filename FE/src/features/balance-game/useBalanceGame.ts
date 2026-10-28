import { useEffect, useRef, useState } from "react";
import {
  BalanceGameApiError,
  getBalanceGameQuestions,
  getBalanceGameRecommendations,
} from "./api/balanceGame";
import type {
  BalanceGameAnswer,
  BalanceGameQuestion,
  BalanceGameRecommendation,
} from "./model/balanceGame";

type GameState =
  | { status: "loading" | "empty" }
  | { status: "error"; message: string }
  | { status: "playing"; questions: BalanceGameQuestion[] }
  | {
      status: "result";
      questions: BalanceGameQuestion[];
      items: BalanceGameRecommendation[];
    };

export function useBalanceGame(onAuthenticationRequired: () => void) {
  const [state, setState] = useState<GameState>({ status: "loading" });
  const [revision, setRevision] = useState(0);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<BalanceGameAnswer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);

  const handleError = (cause: unknown, fallback: string) => {
    if (cause instanceof BalanceGameApiError) {
      if (
        cause.status === 401 ||
        cause.errorCode === 201 ||
        cause.errorCode === 204 ||
        cause.errorCode === 211
      ) {
        onAuthenticationRequired();
      }
      return cause.message;
    }
    return fallback;
  };

  useEffect(() => {
    const controller = new AbortController();
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
        if (
          cause instanceof BalanceGameApiError &&
          (cause.status === 401 ||
            cause.errorCode === 201 ||
            cause.errorCode === 204 ||
            cause.errorCode === 211)
        )
          onAuthenticationRequired();
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
  }, [revision, onAuthenticationRequired]);

  useEffect(
    () => () => {
      pending.current?.abort();
    },
    [],
  );

  const question = "questions" in state ? state.questions[index] : undefined;
  const selected = answers.find(
    (answer) => answer.questionId === question?.id,
  )?.optionId;

  const submit = async () => {
    if (
      state.status !== "playing" ||
      pending.current ||
      answers.length !== state.questions.length
    )
      return;
    const controller = new AbortController();
    pending.current = controller;
    setSubmitting(true);
    setError(null);
    try {
      const items = await getBalanceGameRecommendations(
        answers,
        controller.signal,
      );
      if (!controller.signal.aborted)
        setState({ status: "result", questions: state.questions, items });
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          handleError(
            cause,
            "추천을 불러오지 못했어요. 답변은 유지되니 다시 시도해 주세요.",
          ),
        );
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        if (!controller.signal.aborted) setSubmitting(false);
      }
    }
  };

  return {
    state,
    question,
    index,
    selected,
    submitting,
    error,
    answers,
    retry: () => {
      setState({ status: "loading" });
      setRevision((value) => value + 1);
    },
    select: (optionId: BalanceGameAnswer["optionId"]) => {
      if (!question || pending.current) return;
      setAnswers((current) => [
        ...current.filter((answer) => answer.questionId !== question.id),
        { questionId: question.id, optionId },
      ]);
      setError(null);
    },
    previous: () => {
      if (!pending.current) {
        setIndex((value) => Math.max(0, value - 1));
        setError(null);
      }
    },
    next: () => {
      if (!selected || state.status !== "playing" || pending.current) return;
      if (index === state.questions.length - 1) void submit();
      else {
        setIndex((value) => value + 1);
        setError(null);
      }
    },
    edit: () => {
      if (state.status === "result") {
        setState({ status: "playing", questions: state.questions });
        setIndex(0);
        setError(null);
      }
    },
  };
}
