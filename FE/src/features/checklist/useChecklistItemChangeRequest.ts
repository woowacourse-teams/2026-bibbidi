import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChecklistItemChangeFeedback,
  ChecklistItemChangeKind,
} from "./model/checklistEditing";
import { ChecklistAudience } from "./model/checklistQuery";
import { ChecklistItemChangeError } from "./repository/myChecklistCommandRepository";
import {
  MyChecklistAuthenticationRequiredError,
  MyChecklistRequestAbortedError,
} from "./repository/myChecklistQueryRepository";

const idleFeedback: ChecklistItemChangeFeedback = { status: "idle" };

export function useChecklistItemChangeRequest(
  refreshAuth: () => void,
  audience: ChecklistAudience | undefined,
  onRefreshFailed?: (message: string) => void,
) {
  const [changeFeedback, setChangeFeedback] =
    useState<ChecklistItemChangeFeedback>(idleFeedback);
  const activeRequestRef = useRef<
    | {
        controller: AbortController;
        itemId: number;
        kind: ChecklistItemChangeKind;
      }
    | undefined
  >(undefined);
  const requestGenerationRef = useRef(0);
  useEffect(
    () => () => {
      requestGenerationRef.current += 1;
      activeRequestRef.current?.controller.abort();
    },
    [],
  );
  useEffect(() => {
    if (audience !== "guest") return;
    requestGenerationRef.current += 1;
    activeRequestRef.current?.controller.abort();
    activeRequestRef.current = undefined;
    let isActive = true;
    queueMicrotask(() => {
      if (isActive) setChangeFeedback(idleFeedback);
    });
    return () => {
      isActive = false;
    };
  }, [audience]);
  const runRequest = useCallback(
    async <T>(
      itemId: number,
      kind: ChecklistItemChangeKind,
      request: (signal: AbortSignal) => Promise<T>,
    ): Promise<{ ok: true; value: T } | { error?: unknown; ok: false }> => {
      if (activeRequestRef.current) {
        return { ok: false };
      }

      const controller = new AbortController();
      const requestGeneration = requestGenerationRef.current + 1;
      requestGenerationRef.current = requestGeneration;
      activeRequestRef.current = { controller, itemId, kind };
      setChangeFeedback({ itemId, kind, status: "pending" });

      try {
        const value = await request(controller.signal);

        if (requestGenerationRef.current !== requestGeneration) {
          return { ok: false };
        }

        setChangeFeedback(idleFeedback);
        return { ok: true, value };
      } catch (error) {
        if (requestGenerationRef.current !== requestGeneration) {
          return { error, ok: false };
        }

        if (
          controller.signal.aborted ||
          error instanceof MyChecklistRequestAbortedError
        ) {
          setChangeFeedback(idleFeedback);
          return { ok: false };
        }

        if (error instanceof MyChecklistAuthenticationRequiredError) {
          refreshAuth();
          setChangeFeedback({
            errorMessage: error.message,
            itemId,
            kind,
            status: "error",
          });
          return { ok: false };
        }

        if (
          error instanceof ChecklistItemChangeError &&
          error.reason === "refresh-failed"
        ) {
          onRefreshFailed?.(error.message);
        }

        setChangeFeedback({
          errorMessage:
            error instanceof ChecklistItemChangeError
              ? error.message
              : "할 일을 수정하지 못했습니다. 잠시 후 다시 시도해주세요.",
          itemId,
          kind,
          status: "error",
        });
        return { error, ok: false };
      } finally {
        if (activeRequestRef.current?.controller === controller) {
          activeRequestRef.current = undefined;
        }
      }
    },
    [onRefreshFailed, refreshAuth],
  );

  return {
    changeFeedback,
    runRequest,
    cancelOtherRequest: useCallback(
      (kind: ChecklistItemChangeKind, itemId: number | null) => {
        const active = activeRequestRef.current;
        if (active?.kind === kind && active.itemId !== itemId) {
          requestGenerationRef.current += 1;
          active.controller.abort();
          activeRequestRef.current = undefined;
        }
      },
      [],
    ),
    resetFeedback: useCallback(
      (kind?: ChecklistItemChangeKind, exceptItemId?: number | null) => {
        setChangeFeedback((current) =>
          current.status !== "idle" &&
          (!kind || current.kind === kind) &&
          current.itemId !== exceptItemId
            ? idleFeedback
            : current,
        );
      },
      [],
    ),
    clearError: useCallback((itemId: number) => {
      setChangeFeedback((current) =>
        current.status === "error" && current.itemId === itemId
          ? idleFeedback
          : current,
      );
    }, []),
  };
}
