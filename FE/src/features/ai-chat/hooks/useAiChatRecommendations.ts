import { useEffect, useMemo, useRef, useState } from "react";

import { catalogRepository, type CatalogModel } from "../../catalog";
import {
  useMyChecklistQueryRepository,
  MyChecklistAuthenticationRequiredError,
} from "../../checklist";
import {
  usePreparationChecklistRepository,
  useCatalogTaskAddition,
  PreparationAuthenticationRequiredError,
} from "../../preparation";
import { PreparationDuplicateChecklistItemError } from "../../preparation/repository/preparationErrors";
import type { ChatMessage } from "../model/aiChat";
import type {
  RecommendedTask,
  RecommendationController,
} from "../model/recommendation";

interface RecommendationState {
  dismissed: string[];
  selectedId?: string;
  additionId?: string;
}

const EMPTY_STATE: RecommendationState = { dismissed: [] };

export function useAiChatRecommendations(
  messages: ChatMessage[],
  isAuthenticated: boolean,
  onAuthenticationRequired: () => void,
  onTaskAdded?: (catalogItemId: number) => void,
): RecommendationController {
  const checklist = usePreparationChecklistRepository();
  const query = useMyChecklistQueryRepository();
  const [catalogResult, setCatalogResult] = useState<{
    catalog?: CatalogModel;
    failed?: boolean;
  } | null>(null);
  const [states, setStates] = useState<Record<number, RecommendationState>>({});
  const pendingAnswers = useRef(new Map<number, symbol>());
  const addition = useCatalogTaskAddition({
    authScope: isAuthenticated ? "authenticated" : "guest",
    isAuthenticated,
    onAuthenticationRequired,
    repository: checklist,
    onSuccess: (catalogItemId, itemCount) => {
      if (itemCount > 0) onTaskAdded?.(catalogItemId);
    },
    errorMessage: "할 일을 저장하지 못했어요. 다시 시도해 주세요.",
    saveCatalogItem: async (catalogItemId, signal) => {
      const id = String(catalogItemId);
      const existing = await checklist.getCatalogItemIds(
        "authenticated",
        signal,
      );
      if (signal.aborted || existing.includes(id)) return [];
      try {
        return await checklist.addCatalogItemIds("authenticated", [id], signal);
      } catch (error) {
        if (!(error instanceof PreparationDuplicateChecklistItemError))
          throw error;
        // 목록 동기화까지 성공해야 카드를 제거한다. 실패하면 같은 카드에서 재시도한다.
        try {
          await query.refresh(signal);
        } catch (refreshError) {
          if (refreshError instanceof MyChecklistAuthenticationRequiredError)
            throw new PreparationAuthenticationRequiredError();
          throw refreshError;
        }
        return [];
      }
    },
  });
  const hasRecommendations =
    isAuthenticated &&
    messages.some(
      (message) =>
        message.role === "assistant" &&
        message.status === "complete" &&
        Boolean(message.catalogItemIds?.length),
    );

  useEffect(() => {
    if (!hasRecommendations || catalogResult) return;
    const controller = new AbortController();
    catalogRepository.getCatalog(controller.signal).then(
      (catalog) => {
        if (!controller.signal.aborted) setCatalogResult({ catalog });
      },
      () => {
        if (!controller.signal.aborted) setCatalogResult({ failed: true });
      },
    );
    return () => controller.abort();
  }, [hasRecommendations, catalogResult]);

  useEffect(() => {
    const pending = pendingAnswers.current;
    return () => pending.clear();
  }, [checklist, isAuthenticated]);

  const tasksById = useMemo(() => {
    const catalog = catalogResult?.catalog;
    const steps = new Map(
      catalog?.roadmaps.flatMap((roadmap) =>
        roadmap.steps.map((step) => [step.id, step.title] as const),
      ),
    );
    return new Map(
      catalog?.stepDetails.flatMap((detail) =>
        detail.tasks.map(
          (task) =>
            [
              task.id,
              { ...task, stepTitle: steps.get(detail.stepId) ?? "" },
            ] as const,
        ),
      ),
    );
  }, [catalogResult]);

  const update = (answerId: number, change: Partial<RecommendationState>) => {
    setStates((current) => ({
      ...current,
      [answerId]: { ...(current[answerId] ?? EMPTY_STATE), ...change },
    }));
  };

  const cards = (answerId: number, ids: string[]): RecommendedTask[] =>
    ids.flatMap((id, index) => {
      const task = tasksById.get(id);
      return task &&
        !addition.addedCatalogItemIds.includes(Number(id)) &&
        !states[answerId]?.dismissed.includes(id)
        ? [
            {
              id,
              title: task.title,
              stepTitle: task.stepTitle,
              order: index + 1,
            },
          ]
        : [];
    });

  const nextCardId = (answerId: number, id: string) => {
    const message = messages.find((message) => message.id === answerId);
    const current = cards(
      answerId,
      message?.role === "assistant" ? (message.catalogItemIds ?? []) : [],
    );
    const index = current.findIndex((task) => task.id === id);
    const remaining = current.filter((task) => task.id !== id);
    return remaining[Math.min(Math.max(0, index), remaining.length - 1)]?.id;
  };

  const skip = (answerId: number, id: string) => {
    if (!isAuthenticated || pendingAnswers.current.has(answerId)) return;
    setStates((current) => {
      const state = current[answerId] ?? EMPTY_STATE;
      return {
        ...current,
        [answerId]: {
          ...state,
          dismissed: [...state.dismissed, id],
          selectedId: nextCardId(answerId, id),
          additionId: undefined,
        },
      };
    });
  };

  const add = async (answerId: number, id: string) => {
    if (!isAuthenticated || pendingAnswers.current.has(answerId)) return;
    const request = Symbol();
    pendingAnswers.current.set(answerId, request);
    update(answerId, { additionId: id });
    const saved = await addition.add(Number(id));
    if (pendingAnswers.current.get(answerId) !== request) return;
    pendingAnswers.current.delete(answerId);
    if (saved) update(answerId, { selectedId: nextCardId(answerId, id) });
  };

  return {
    forAnswer: (answerId, ids) => {
      const state = states[answerId];
      const id = Number(state?.additionId);
      return {
        tasks: cards(answerId, ids),
        selectedId: state?.selectedId,
        saving: addition.addingCatalogItemIds.includes(id),
        error: addition.additionErrors[id],
        onSelect: (id) => {
          if (!pendingAnswers.current.has(answerId))
            update(answerId, { selectedId: id, additionId: undefined });
        },
        onSkip: (id) => skip(answerId, id),
        onAdd: (id) => {
          void add(answerId, id);
        },
      };
    },
    catalogStatus: catalogResult?.catalog
      ? ("ready" as const)
      : catalogResult?.failed
        ? ("error" as const)
        : ("loading" as const),
    retryCatalog: () => setCatalogResult(null),
  };
}
