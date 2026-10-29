import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { catalogRepository } from "../catalog";
import { resolveRecommendations } from "./model/recommendations";
import type { BalanceGameTracking } from "./analytics/balanceGameTracking";
import { Button } from "../../components/button";
import { Checkbox } from "../../components/checkbox";
import { Result } from "../../components/result";
import {
  useMyChecklistQueryRepository,
  MyChecklistAuthenticationRequiredError,
} from "../checklist";
import {
  PreparationAuthenticationRequiredError,
  usePreparationChecklistRepository,
} from "../preparation";
import { addRecommendedTasks } from "../preparation/commands/addRecommendedTasks";
import type {
  BalanceGameRecommendation,
  BalanceGameResult,
} from "./model/balanceGame";

export function BalanceGameResults({
  result,
  audience,
  tracking,
  requestDurationMs,
  resultInstanceId,
  initialSelection,
  onEdit,
  onAuthenticationRequired,
  onLoginRequired,
}: {
  result: BalanceGameResult;
  audience: "guest" | "authenticated";
  tracking: BalanceGameTracking;
  requestDurationMs: number;
  resultInstanceId: string;
  initialSelection?: number[];
  onEdit: () => void;
  onAuthenticationRequired: (selectedIds: number[]) => void;
  onLoginRequired: (selectedIds: number[]) => boolean;
}) {
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
  const [imageFailed, setImageFailed] = useState(false);
  const [loadDuration, setLoadDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const pending = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const viewSent = useRef<string | null>(null);
  const selectAllId = useId();
  const recommendationId = resultInstanceId;

  useEffect(() => {
    heading.current?.focus();
  }, []);
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
  const groups = [...new Set(items.map((item) => item.categoryName))];
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
      setAddedIds((current) => [
        ...new Set([...current, ...saved.confirmedIds]),
      ]);
      setSelectedIds((current) =>
        current.filter((id) => !saved.confirmedIds.includes(id)),
      );
      setNotice(
        `${saved.confirmedIds.length}개의 할 일을 체크리스트에서 확인할 수 있어요.`,
      );
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

  return (
    <section
      className="balance-game__results"
      aria-labelledby="balance-game-result-title"
    >
      <div className="balance-game__type-card">
        <h1 id="balance-game-result-title" ref={heading} tabIndex={-1}>
          {result.name}
        </h1>
        {result.imageUrl && !imageFailed && (
          <img
            src={result.imageUrl}
            alt=""
            onError={() => setImageFailed(true)}
          />
        )}
        <p className="balance-game__description">{result.summary}</p>
      </div>
      <h2>우리에게 맞는 추천 할 일</h2>
      <p className="balance-game__description">
        목록을 확인하고 필요한 항목을 체크리스트에 담아보세요.
      </p>
      <Button
        size="small"
        color="dark"
        variant="weak"
        disabled={saving}
        onClick={onEdit}
      >
        답변 수정하기
      </Button>
      {status === "loading" && (
        <p role="status">이미 담은 할 일을 확인하고 있어요.</p>
      )}
      {status === "error" && (
        <Result
          title="추천 할 일을 불러오지 못했어요"
          button={
            <Result.Button
              onClick={() => {
                setStatus("loading");
                setRevision((value) => value + 1);
              }}
            >
              다시 시도
            </Result.Button>
          }
        />
      )}
      {status === "ready" &&
        (items.length ? (
          <>
            <div className="balance-game__selection-toolbar">
              <label htmlFor={selectAllId}>
                <Checkbox
                  id={selectAllId}
                  checked={
                    available.length > 0 &&
                    selectedIds.length === available.length
                  }
                  disabled={saving || !available.length}
                  onCheckedChange={(checked) => select(checked)}
                />
                전체 선택
              </label>
              <span>
                {selectedIds.length}개 선택 · {items.length - available.length}
                개 이미 담음
              </span>
            </div>
            <div className="balance-game__groups">
              {groups.map((category, index) => (
                <details key={category} open={index === 0}>
                  <summary>
                    {category}
                    <span>
                      {
                        items.filter((item) => item.categoryName === category)
                          .length
                      }
                      개
                    </span>
                  </summary>
                  <ul>
                    {items
                      .filter((item) => item.categoryName === category)
                      .map((item) => {
                        const id = String(item.catalogItemId);
                        const added = addedIds.includes(id);
                        return (
                          <li key={id}>
                            <label>
                              <Checkbox
                                checked={added || selectedIds.includes(id)}
                                disabled={saving || added}
                                onCheckedChange={(checked) =>
                                  select(checked, id)
                                }
                              />
                              <span>
                                <strong>{item.title}</strong>
                                <small>{item.stepName}</small>
                              </span>
                              {added && (
                                <span className="balance-game__added">
                                  이미 담음
                                </span>
                              )}
                            </label>
                          </li>
                        );
                      })}
                  </ul>
                </details>
              ))}
            </div>
            <p className="balance-game__notice" role="status">
              {notice}
            </p>
            {error && (
              <p className="balance-game__error" role="alert">
                {error}
              </p>
            )}
            <div className="balance-game__result-footer">
              <Link to="/checklist">체크리스트로 이동</Link>
              <Button
                loading={saving}
                disabled={!selectedIds.length}
                onClick={() => void save()}
              >
                {selectedIds.length
                  ? audience === "guest"
                    ? `로그인하고 ${selectedIds.length}개 할 일 담기`
                    : `${selectedIds.length}개 할 일 담기`
                  : available.length
                    ? "담을 할 일을 선택해 주세요"
                    : "모든 할 일을 담았어요"}
              </Button>
            </div>
          </>
        ) : (
          <Result
            title="추천된 할 일이 없어요"
            button={
              <Result.Button onClick={onEdit}>답변 다시 고르기</Result.Button>
            }
          />
        ))}
    </section>
  );
}
