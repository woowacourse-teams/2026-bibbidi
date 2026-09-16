import { useCallback, useEffect, useRef, useState } from "react";

import {
  ChecklistItemCategoryEditSession,
  ChecklistItemChangeFeedback,
  ChecklistItemChangeKind,
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
  const [categoryEditSession, setCategoryEditSession] =
    useState<ChecklistItemCategoryEditSession | null>(null);
  const [titleEditSession, setTitleEditSession] =
    useState<ChecklistItemTitleEditSession | null>(null);
  const [changeFeedback, setChangeFeedback] =
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
        setCategoryEditSession(null);
        setTitleEditSession(null);
        setChangeFeedback(idleFeedback);
      }
    });

    return () => {
      isActive = false;
    };
  }, [audience]);

  const runChange = useCallback(
    async (
      itemId: number,
      kind: ChecklistItemChangeKind,
      request: (signal: AbortSignal) => Promise<void>,
    ): Promise<boolean> => {
      if (controllerRef.current) {
        return false;
      }

      const controller = new AbortController();
      const requestGeneration = requestGenerationRef.current + 1;
      requestGenerationRef.current = requestGeneration;
      controllerRef.current = controller;
      setChangeFeedback({ itemId, kind, status: "pending" });

      try {
        await request(controller.signal);

        if (requestGenerationRef.current !== requestGeneration) {
          return false;
        }

        setChangeFeedback(idleFeedback);
        return true;
      } catch (error) {
        if (requestGenerationRef.current !== requestGeneration) {
          return false;
        }

        if (
          controller.signal.aborted ||
          error instanceof MyChecklistRequestAbortedError
        ) {
          setChangeFeedback(idleFeedback);
          return false;
        }

        if (error instanceof MyChecklistAuthenticationRequiredError) {
          refreshAuth();
          setChangeFeedback({
            errorMessage: error.message,
            itemId,
            kind,
            status: "error",
          });
          return false;
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
    categoryEditSession,
    changeCategory: useCallback(
      (itemId: number, categoryId: string) =>
        runChange(itemId, "category", (signal) =>
          commandRepository.changeItemCategory(
            itemId,
            Number(categoryId),
            signal,
          ),
        ),
      [commandRepository, runChange],
    ),
    changeFeedback,
    changeTitle: useCallback(
      (itemId: number, title: string) =>
        runChange(itemId, "title", (signal) =>
          commandRepository.changeItemTitle(itemId, title, signal),
        ),
      [commandRepository, runChange],
    ),
    clearError: useCallback((itemId: number) => {
      setChangeFeedback((current) =>
        current.status === "error" && current.itemId === itemId
          ? idleFeedback
          : current,
      );
    }, []),
    finishCategoryEditing: useCallback((itemId: number) => {
      setCategoryEditSession((current) =>
        current?.itemId === itemId ? null : current,
      );
    }, []),
    finishTitleEditing: useCallback((itemId: number) => {
      setTitleEditSession((current) =>
        current?.itemId === itemId ? null : current,
      );
    }, []),
    startCategoryEditing: useCallback((itemId: number) => {
      setTitleEditSession(null);
      setCategoryEditSession({ itemId });
    }, []),
    startTitleEditing: useCallback((itemId: number, title: string) => {
      setCategoryEditSession(null);
      setTitleEditSession({ draft: title, itemId });
    }, []),
    titleEditSession,
    updateTitleDraft: useCallback((itemId: number, draft: string) => {
      setTitleEditSession((current) =>
        current?.itemId === itemId ? { draft, itemId } : current,
      );
    }, []),
  };
}
