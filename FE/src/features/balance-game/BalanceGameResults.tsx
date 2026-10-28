import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
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
import type { BalanceGameRecommendation } from "./model/balanceGame";

export function BalanceGameResults({
  items,
  onEdit,
  onAuthenticationRequired,
}: {
  items: BalanceGameRecommendation[];
  onEdit: () => void;
  onAuthenticationRequired: () => void;
}) {
  const checklist = usePreparationChecklistRepository();
  const query = useMyChecklistQueryRepository();
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const pending = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const selectAllId = useId();

  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    checklist.getCatalogItemIds("authenticated", controller.signal).then(
      (ids) => {
        if (controller.signal.aborted) return;
        setAddedIds(ids);
        setSelectedIds(
          items
            .map((item) => String(item.catalogItemId))
            .filter((id) => !ids.includes(id)),
        );
        setStatus("ready");
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        if (cause instanceof PreparationAuthenticationRequiredError)
          onAuthenticationRequired();
        setStatus("error");
      },
    );
    return () => controller.abort();
  }, [checklist, items, revision, onAuthenticationRequired]);
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
  const save = async () => {
    if (pending.current || !selectedIds.length || status !== "ready") return;
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true);
    setError(null);
    try {
      const result = await addRecommendedTasks({
        ids: selectedIds,
        checklist,
        query,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setAddedIds((current) => [
        ...new Set([...current, ...result.confirmedIds]),
      ]);
      setSelectedIds((current) =>
        current.filter((id) => !result.confirmedIds.includes(id)),
      );
      setNotice(
        `${result.confirmedIds.length}개의 할 일을 체크리스트에서 확인할 수 있어요.`,
      );
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (
        cause instanceof PreparationAuthenticationRequiredError ||
        cause instanceof MyChecklistAuthenticationRequiredError
      )
        onAuthenticationRequired();
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
      <h1 id="balance-game-result-title" ref={heading} tabIndex={-1}>
        우리에게 맞는
        <br />
        결혼 준비를 모았어요.
      </h1>
      <p className="balance-game__description">
        공통으로 필요한 준비와 답변에 맞춘 할 일 {items.length}개예요.
        <br />
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
          title="체크리스트를 확인하지 못했어요"
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
                  onCheckedChange={(checked) =>
                    setSelectedIds(
                      checked
                        ? available.map((item) => String(item.catalogItemId))
                        : [],
                    )
                  }
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
                                  setSelectedIds((current) =>
                                    checked
                                      ? [...current, id]
                                      : current.filter((value) => value !== id),
                                  )
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
                  ? `${selectedIds.length}개 할 일 담기`
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
