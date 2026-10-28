import { useEffect, useRef, useState } from "react";

import {
  useMyChecklistQueryRepository,
  MyChecklistAuthenticationRequiredError,
} from "../../checklist";
import {
  usePreparationChecklistRepository,
  PreparationAuthenticationRequiredError,
} from "../../preparation";
import { addRecommendedTasks } from "../../preparation/commands/addRecommendedTasks";
import { useAiChatRecommendationCatalog } from "./useAiChatRecommendationCatalog";
import type { ChatMessage } from "../model/aiChat";
import type {
  RecommendedTask,
  RecommendationController,
} from "../model/recommendation";

interface RecommendationState {
  selectedIds: string[];
  error?: string;
  dismissed?: boolean;
}
const EMPTY_STATE: RecommendationState = { selectedIds: [] };

export function useAiChatRecommendations(
  messages: ChatMessage[],
  isAuthenticated: boolean,
  onAuthenticationRequired: () => void,
  onTaskAdded?: (catalogItemIds: number[]) => void,
): RecommendationController {
  const checklist = usePreparationChecklistRepository();
  const query = useMyChecklistQueryRepository();
  const [states, setStates] = useState<Record<number, RecommendationState>>({});
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const hasRecommendations =
    isAuthenticated &&
    messages.some(
      (message) =>
        message.role === "assistant" &&
        message.status === "complete" &&
        Boolean(message.catalogItemIds?.length),
    );

  const catalog = useAiChatRecommendationCatalog(hasRecommendations);

  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
    },
    [checklist, isAuthenticated],
  );

  const tasks = (ids: string[]): RecommendedTask[] =>
    [...new Set(ids)].flatMap((id) => {
      const task = catalog.tasksById.get(id);
      return task && !addedIds.includes(id) ? [task] : [];
    });

  const update = (answerId: number, change: Partial<RecommendationState>) => {
    setStates((current) => ({
      ...current,
      [answerId]: { ...(current[answerId] ?? EMPTY_STATE), ...change },
    }));
  };

  const add = async (answerId: number, ids: string[]) => {
    if (!isAuthenticated || pending.current || !ids.length) return;
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true);
    update(answerId, { error: undefined });
    const signal = controller.signal;
    try {
      const result = await addRecommendedTasks({
        ids,
        checklist,
        query,
        signal,
      });
      if (signal.aborted || pending.current !== controller) return;
      const { confirmedIds, addedIds: savedIds } = result;
      setAddedIds((current) => [...new Set([...current, ...confirmedIds])]);
      update(answerId, {
        selectedIds: ids.filter((id) => !confirmedIds.includes(id)),
      });
      if (savedIds.length) onTaskAdded?.(savedIds.map(Number));
    } catch (error) {
      if (signal.aborted) return;
      const expired =
        error instanceof PreparationAuthenticationRequiredError ||
        error instanceof MyChecklistAuthenticationRequiredError;
      update(answerId, {
        error: expired
          ? "로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요."
          : "할 일을 저장하지 못했어요. 다시 시도해 주세요.",
      });
      if (expired) onAuthenticationRequired();
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setSaving(false);
      }
    }
  };

  return {
    forAnswer: (answerId, ids) => {
      const state = states[answerId] ?? EMPTY_STATE;
      const available = tasks(ids);
      const selectedIds = state.selectedIds.filter((id) =>
        available.some((task) => task.id === id),
      );
      return {
        tasks: available,
        selectedIds,
        saving,
        dismissed: Boolean(state.dismissed),
        error: state.error,
        onSelect: (id) => {
          if (
            state.dismissed ||
            pending.current ||
            !available.some((task) => task.id === id)
          )
            return;
          update(answerId, {
            selectedIds: selectedIds.includes(id)
              ? selectedIds.filter((selected) => selected !== id)
              : [...selectedIds, id],
            error: undefined,
          });
        },
        onDismiss: () => {
          if (pending.current) return;
          update(answerId, {
            dismissed: true,
            selectedIds: [],
            error: undefined,
          });
        },
        onRestore: () => {
          if (pending.current) return;
          update(answerId, { dismissed: false });
        },
        onAdd: () => {
          if (!state.dismissed) void add(answerId, selectedIds);
        },
      };
    },
    catalogStatus: catalog.status,
    retryCatalog: catalog.retry,
  };
}
