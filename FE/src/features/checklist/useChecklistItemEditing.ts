import { useCallback, useEffect, useRef, useState } from "react";

import { analytics } from "../../infrastructure/analytics";
import {
  createChecklistTaskCategoryUpdateEvent,
  createChecklistTaskCompleteEvent,
  createChecklistTaskTitleUpdateEvent,
} from "./analytics/checklistAnalytics";
import {
  ChecklistItemCategoryEditSession,
  ChecklistItemChangeFeedback,
  ChecklistItemChangeKind,
  ChecklistItemEditingController,
  ChecklistItemStatusConfirmation,
  ChecklistItemStatusEditSession,
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
  activeItemId?: number | null,
  onRefreshFailed?: (message: string) => void,
  activeCategoryId?: string | null,
): ChecklistItemEditingController {
  const [categoryEditSession, setCategoryEditSession] =
    useState<ChecklistItemCategoryEditSession | null>(null);
  const [titleEditSession, setTitleEditSession] =
    useState<ChecklistItemTitleEditSession | null>(null);
  const [statusEditSession, setStatusEditSession] =
    useState<ChecklistItemStatusEditSession | null>(null);
  const [statusConfirmation, setStatusConfirmation] =
    useState<ChecklistItemStatusConfirmation | null>(null);
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
    if (audience !== "guest") {
      return;
    }

    requestGenerationRef.current += 1;
    activeRequestRef.current?.controller.abort();
    activeRequestRef.current = undefined;
    let isActive = true;

    queueMicrotask(() => {
      if (isActive) {
        setCategoryEditSession(null);
        setStatusEditSession(null);
        setStatusConfirmation(null);
        setTitleEditSession(null);
        setChangeFeedback(idleFeedback);
      }
    });

    return () => {
      isActive = false;
    };
  }, [audience]);

  useEffect(() => {
    if (activeItemId === undefined) {
      return;
    }

    const activeRequest = activeRequestRef.current;

    if (
      activeRequest?.kind === "status" &&
      activeRequest.itemId !== activeItemId
    ) {
      requestGenerationRef.current += 1;
      activeRequest.controller.abort();
      activeRequestRef.current = undefined;
    }

    let isActive = true;

    queueMicrotask(() => {
      if (!isActive) {
        return;
      }

      setStatusEditSession((current) =>
        current && current.itemId !== activeItemId ? null : current,
      );
      setStatusConfirmation((current) =>
        current && current.itemId !== activeItemId ? null : current,
      );
      setChangeFeedback((current) =>
        current.status !== "idle" &&
        current.kind === "status" &&
        current.itemId !== activeItemId
          ? idleFeedback
          : current,
      );
    });

    return () => {
      isActive = false;
    };
  }, [activeItemId]);

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
    categoryEditSession,
    cancelStatusChange: useCallback((itemId: number) => {
      setStatusConfirmation((current) =>
        current?.itemId === itemId ? null : current,
      );
      setChangeFeedback((current) =>
        current.status === "error" && current.itemId === itemId
          ? idleFeedback
          : current,
      );
    }, []),
    changeCategory: useCallback(
      async (itemId: number, categoryId: string) => {
        const result = await runRequest(itemId, "category", (signal) =>
          commandRepository.changeItemCategory(
            itemId,
            Number(categoryId),
            signal,
          ),
        );

        if (result.ok) {
          analytics.track(createChecklistTaskCategoryUpdateEvent(categoryId));
        }

        return result.ok;
      },
      [commandRepository, runRequest],
    ),
    changeFeedback,
    changeTitle: useCallback(
      async (itemId: number, title: string) => {
        const result = await runRequest(itemId, "title", (signal) =>
          commandRepository.changeItemTitle(itemId, title, signal),
        );

        if (result.ok) {
          analytics.track(createChecklistTaskTitleUpdateEvent());
        }

        return result.ok;
      },
      [commandRepository, runRequest],
    ),
    confirmStatusChange: useCallback(
      async (itemId: number) => {
        if (statusConfirmation?.itemId !== itemId) {
          return false;
        }

        const result = await runRequest(itemId, "status", (signal) =>
          commandRepository.changeItemStatus(
            itemId,
            statusConfirmation.status,
            signal,
          ),
        );

        const didStatusChangeButRefreshFail =
          !result.ok &&
          result.error instanceof ChecklistItemChangeError &&
          result.error.reason === "refresh-failed";

        if (result.ok || didStatusChangeButRefreshFail) {
          setStatusConfirmation(null);
        }

        if (result.ok && activeCategoryId) {
          analytics.track(createChecklistTaskCompleteEvent(activeCategoryId));
        }

        return result.ok;
      },
      [activeCategoryId, commandRepository, runRequest, statusConfirmation],
    ),
    requestStatusChange: useCallback(
      async (itemId, status) => {
        if (status === "done") {
          const remainingResult = await runRequest(itemId, "status", (signal) =>
            commandRepository.hasRemainingAppointments(itemId, signal),
          );

          if (!remainingResult.ok) {
            return "failed";
          }

          if (remainingResult.value) {
            setStatusConfirmation({ itemId, status: "done" });
            return "confirmation-required";
          }
        }

        const changeResult = await runRequest(itemId, "status", (signal) =>
          commandRepository.changeItemStatus(itemId, status, signal),
        );

        if (changeResult.ok && status === "done" && activeCategoryId) {
          analytics.track(createChecklistTaskCompleteEvent(activeCategoryId));
        }

        return changeResult.ok ? "changed" : "failed";
      },
      [activeCategoryId, commandRepository, runRequest],
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
    finishStatusEditing: useCallback((itemId: number) => {
      setStatusEditSession((current) =>
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
      setStatusEditSession(null);
      setCategoryEditSession({ itemId });
    }, []),
    startStatusEditing: useCallback((itemId: number) => {
      setCategoryEditSession(null);
      setTitleEditSession(null);
      setStatusEditSession({ itemId });
    }, []),
    startTitleEditing: useCallback((itemId: number, title: string) => {
      setCategoryEditSession(null);
      setStatusEditSession(null);
      setTitleEditSession({ draft: title, itemId });
    }, []),
    statusConfirmation,
    statusEditSession,
    titleEditSession,
    updateTitleDraft: useCallback((itemId: number, draft: string) => {
      setTitleEditSession((current) =>
        current?.itemId === itemId ? { draft, itemId } : current,
      );
    }, []),
  };
}
