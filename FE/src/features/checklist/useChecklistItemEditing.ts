import { useCallback, useEffect, useRef, useState } from "react";

import {
  ChecklistItemChangeFeedback,
  ChecklistItemEditingController,
  ChecklistItemTitleEditSession,
} from "./model/checklistEditing";
import { ChecklistAudience } from "./model/checklistQuery";
import {
  ChecklistItemChangeError,
  MyChecklistCommandRepository,
} from "./repository/myChecklistCommandRepository";
import {
  MyChecklistAuthenticationRequiredError,
  MyChecklistRequestAbortedError,
} from "./repository/myChecklistQueryRepository";

const idleFeedback: ChecklistItemChangeFeedback = { status: "idle" };

export function useChecklistItemEditing(
  commandRepository: MyChecklistCommandRepository,
  refreshAuth: () => void,
  audience: ChecklistAudience | undefined,
): ChecklistItemEditingController {
  const [titleEditSession, setTitleEditSession] =
    useState<ChecklistItemTitleEditSession | null>(null);
  const [titleFeedback, setTitleFeedback] =
    useState<ChecklistItemChangeFeedback>(idleFeedback);
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const requestGenerationRef = useRef(0);

  useEffect(
    () => () => {
      requestGenerationRef.current += 1;
      controllerRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (audience !== "guest") {
      return;
    }

    requestGenerationRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = undefined;
    let isActive = true;

    queueMicrotask(() => {
      if (isActive) {
        setTitleEditSession(null);
        setTitleFeedback(idleFeedback);
      }
    });

    return () => {
      isActive = false;
    };
  }, [audience]);

  const runChange = useCallback(
    async (
      itemId: number,
      request: (signal: AbortSignal) => Promise<void>,
    ): Promise<boolean> => {
      if (controllerRef.current) {
        return false;
      }

      const controller = new AbortController();
      const requestGeneration = requestGenerationRef.current + 1;
      requestGenerationRef.current = requestGeneration;
      controllerRef.current = controller;
      setTitleFeedback({ itemId, status: "pending" });

      try {
        await request(controller.signal);

        if (requestGenerationRef.current !== requestGeneration) {
          return false;
        }

        setTitleFeedback(idleFeedback);
        return true;
      } catch (error) {
        if (requestGenerationRef.current !== requestGeneration) {
          return false;
        }

        if (
          controller.signal.aborted ||
          error instanceof MyChecklistRequestAbortedError
        ) {
          setTitleFeedback(idleFeedback);
          return false;
        }

        if (error instanceof MyChecklistAuthenticationRequiredError) {
          refreshAuth();
          setTitleFeedback({
            errorMessage: error.message,
            itemId,
            status: "error",
          });
          return false;
        }

        setTitleFeedback({
          errorMessage:
            error instanceof ChecklistItemChangeError
              ? error.message
              : "할 일을 수정하지 못했습니다. 잠시 후 다시 시도해주세요.",
          itemId,
          status: "error",
        });
        return false;
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = undefined;
        }
      }
    },
    [refreshAuth],
  );

  return {
    changeTitle: useCallback(
      (itemId: number, title: string) =>
        runChange(itemId, (signal) =>
          commandRepository.changeItemTitle(itemId, title, signal),
        ),
      [commandRepository, runChange],
    ),
    clearError: useCallback((itemId: number) => {
      setTitleFeedback((current) =>
        current.status === "error" && current.itemId === itemId
          ? idleFeedback
          : current,
      );
    }, []),
    finishTitleEditing: useCallback((itemId: number) => {
      setTitleEditSession((current) =>
        current?.itemId === itemId ? null : current,
      );
    }, []),
    startTitleEditing: useCallback((itemId: number, title: string) => {
      setTitleEditSession({ draft: title, itemId });
    }, []),
    titleEditSession,
    titleFeedback,
    updateTitleDraft: useCallback((itemId: number, draft: string) => {
      setTitleEditSession((current) =>
        current?.itemId === itemId ? { draft, itemId } : current,
      );
    }, []),
  };
}
