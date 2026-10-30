import { useEffect, useRef, useState } from "react";
import { catalogRepository } from "../catalog";
import {
  useMyChecklistQueryRepository,
  MyChecklistAuthenticationRequiredError,
} from "../checklist";
import {
  PreparationAuthenticationRequiredError,
  usePreparationChecklistRepository,
} from "../preparation";
import { addRecommendedTasks } from "../preparation/commands/addRecommendedTasks";
import type { BalanceGameTracking } from "./analytics/balanceGameTracking";
import type {
  BalanceGameRecommendation,
  BalanceGameResult,
} from "./model/balanceGame";
import {
  groupRecommendations,
  resolveRecommendations,
} from "./model/recommendations";

export interface BalanceGameRecommendationsOptions {
  result: BalanceGameResult;
  audience: "guest" | "authenticated";
  tracking: BalanceGameTracking;
  requestDurationMs: number;
  resultInstanceId: string;
  initialSelection?: number[];
  onAuthenticationRequired: (selectedIds: number[]) => void;
  onLoginRequired: (selectedIds: number[]) => boolean;
  onSaved: () => void;
}

export function useBalanceGameRecommendations({
  result,
  audience,
  tracking,
  requestDurationMs,
  resultInstanceId,
  initialSelection,
  onAuthenticationRequired,
  onLoginRequired,
  onSaved,
}: BalanceGameRecommendationsOptions) {
  const checklist = usePreparationChecklistRepository();
  const query = useMyChecklistQueryRepository();
  const [items, setItems] = useState<BalanceGameRecommendation[]>([]);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loadDuration, setLoadDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const viewSent = useRef<string | null>(null);
  const recommendationId = resultInstanceId;

  useEffect(() => {
    tracking.cardShown(result.id, requestDurationMs, recommendationId);
    const controller = new AbortController();
    const request = tracking.request(
      "recommendations",
      "balance_game_recommendation_request",
      { recommendation_id: recommendationId },
    );
    Promise.all([
      catalogRepository.getCatalog(controller.signal),
      checklist.getCatalogItemIds(audience, controller.signal),
    ])
      .then(([catalog, ids]) => {
        if (controller.signal.aborted) return;
        const resolved = resolveRecommendations(result.catalogItemIds, catalog);
        setItems(resolved);
        setAddedIds(ids);
        setSelectedIds(
          resolved
            .map((item) => String(item.catalogItemId))
            .filter(
              (id) =>
                !ids.includes(id) &&
                (initialSelection === undefined ||
                  initialSelection.includes(Number(id))),
            ),
        );
        setLoadDuration(tracking.duration(request));
        setStatus("ready");
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        tracking.fail(request, cause);
        if (cause instanceof PreparationAuthenticationRequiredError)
          onAuthenticationRequired(initialSelection ?? result.catalogItemIds);
        setStatus("error");
      });
    return () => controller.abort();
  }, [
    checklist,
    result,
    revision,
    onAuthenticationRequired,
    audience,
    initialSelection,
    tracking,
    recommendationId,
    requestDurationMs,
  ]);
  useEffect(
    () => () => {
      pending.current?.abort();
    },
    [],
  );

  const available = items.filter(
    (item) => !addedIds.includes(String(item.catalogItemId)),
  );
  const groups = groupRecommendations(items, addedIds);
  useEffect(() => {
    const viewKey = `${recommendationId}:${audience}:${revision}`;
    if (status !== "ready" || viewSent.current === viewKey) return;
    viewSent.current = viewKey;
    tracking.emit("balance_game_recommendation_view", {
      recommendation_id: recommendationId,
      recommended_count: items.length,
      eligible_count: available.length,
      already_existing_count: items.length - available.length,
      request_duration_ms: loadDuration,
    });
  }, [
    status,
    revision,
    audience,
    recommendationId,
    tracking,
    items.length,
    available.length,
    loadDuration,
  ]);

  const select = (checked: boolean, id?: string) => {
    const next = id
      ? checked
        ? [...new Set([...selectedIds, id])]
        : selectedIds.filter((value) => value !== id)
      : checked
        ? available.map((item) => String(item.catalogItemId))
        : [];
    if (
      next.length === selectedIds.length &&
      next.every((value) => selectedIds.includes(value))
    )
      return;
    tracking.emit("balance_game_task_select", {
      recommendation_id: recommendationId,
      selection_method: id ? "single" : "all",
      selected: checked,
      selected_count: next.length,
      ...(id ? { catalog_item_id: Number(id) } : {}),
    });
    setSelectedIds(next);
  };

  const save = async () => {
    if (pending.current || !selectedIds.length || status !== "ready") return;
    if (audience === "guest") {
      if (!onLoginRequired(selectedIds.map(Number)))
        setError(
          "선택을 보관하지 못했어요. 브라우저 저장 공간을 확인하고 다시 시도해 주세요.",
        );
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true);
    setError(null);
    const request = tracking.request("save", "balance_game_save_submit", {
      recommendation_id: recommendationId,
      eligible_count: available.length,
      selected_count: selectedIds.length,
      excluded_count: available.length - selectedIds.length,
    });
    for (const item of available)
      tracking.emit("balance_game_task_decision", {
        recommendation_id: recommendationId,
        attempt_id: request.id,
        catalog_item_id: item.catalogItemId,
        selected: selectedIds.includes(String(item.catalogItemId)),
        decision_id: `${request.id}:${item.catalogItemId}`,
      });
    try {
      const saved = await addRecommendedTasks({
        ids: selectedIds,
        checklist,
        query,
        signal: controller.signal,
        onCreated: (created) => {
          for (const item of created)
            tracking.emit("balance_game_task_created", {
              recommendation_id: recommendationId,
              attempt_id: request.id,
              origin: "balance_game",
              catalog_item_id: item.catalogItemId,
              checklist_item_id: item.id,
            });
        },
      });
      if (controller.signal.aborted) return;
      tracking.emit("balance_game_save_success", {
        recommendation_id: recommendationId,
        attempt_id: request.id,
        origin: "balance_game",
        created_count: saved.addedIds.length,
        selected_count: selectedIds.length,
        already_existing_count:
          items.length -
          available.length +
          saved.confirmedIds.length -
          saved.addedIds.length,
        request_duration_ms: tracking.duration(request),
      });
      onSaved();
    } catch (cause) {
      if (controller.signal.aborted) return;
      tracking.fail(request, cause);
      if (
        cause instanceof PreparationAuthenticationRequiredError ||
        cause instanceof MyChecklistAuthenticationRequiredError
      )
        onAuthenticationRequired(selectedIds.map(Number));
      setError("할 일을 담지 못했어요. 선택은 유지되니 다시 시도해 주세요.");
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        if (!controller.signal.aborted) setSaving(false);
      }
    }
  };

  return {
    groups,
    totalCount: items.length,
    availableCount: available.length,
    addedIds,
    selectedIds,
    status,
    saving,
    error,
    select,
    save,
    retry: () => {
      setStatus("loading");
      setRevision((value) => value + 1);
    },
  };
}
