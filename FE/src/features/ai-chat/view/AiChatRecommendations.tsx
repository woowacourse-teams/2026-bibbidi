import { useEffect, useId, useRef } from "react";

import { Button } from "../../../components/button";
import { Checkbox } from "../../../components/checkbox";
import { ListHeader } from "../../../components/list-header";
import { ListRow } from "../../../components/list-row";
import type { AnswerRecommendations } from "../model/recommendation";
import "./AiChatRecommendations.css";

export function AiChatRecommendations({
  tasks,
  selectedIds,
  status,
  saving,
  dismissed,
  error,
  onSelect,
  onAdd,
  onRetry,
  onDismiss,
  onRestore,
}: AnswerRecommendations & {
  status: "loading" | "error" | "ready";
  onRetry: () => void;
}) {
  const headingId = useId();
  const helpId = useId();
  const completeRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const restoreButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!saving && restoreFocus.current) {
      if (!error)
        (
          restoreButtonRef.current ??
          firstInputRef.current ??
          completeRef.current
        )?.focus({
          preventScroll: true,
        });
      restoreFocus.current = false;
    }
  }, [saving, tasks.length, error, dismissed]);

  if (status === "loading")
    return <p role="status">추천 할 일을 불러오고 있어요.</p>;
  if (status === "error")
    return (
      <div className="ai-chat__error" role="alert">
        <p>추천 할 일을 불러오지 못했어요.</p>
        <Button size="small" variant="weak" onClick={onRetry}>
          추천 다시 불러오기
        </Button>
      </div>
    );
  if (!tasks.length)
    return (
      <div
        className="ai-recommendations"
        role="status"
        tabIndex={-1}
        ref={completeRef}
      >
        <p>추천을 모두 확인했어요. 더 궁금한 준비가 있나요?</p>
      </div>
    );
  if (dismissed)
    return (
      <section
        className="ai-recommendations ai-recommendations--dismissed"
        aria-label="추천 할 일"
      >
        <span role="status">추천을 건너뛰었어요.</span>
        <Button
          size="small"
          color="dark"
          variant="weak"
          ref={restoreButtonRef}
          disabled={saving}
          onClick={() => {
            restoreFocus.current = true;
            onRestore();
          }}
        >
          추천 다시 보기
        </Button>
      </section>
    );

  return (
    <section
      className="ai-recommendations"
      aria-label="추천 할 일"
      aria-busy={saving}
    >
      <ListHeader
        title="추천 할 일"
        titleId={headingId}
        headingLevel={3}
        horizontalPadding="none"
        right={
          <span
            className="ai-recommendations__selection-count"
            aria-live="polite"
          >
            {selectedIds.length}개 선택
          </span>
        }
      />
      <p className="ai-recommendations__hint" id={helpId}>
        추가할 할 일을 선택해 주세요.
      </p>
      <ul
        className="ai-recommendations__list"
        aria-labelledby={headingId}
        aria-describedby={helpId}
      >
        {tasks.map((task, index) => (
          <li key={task.id}>
            <ListRow
              horizontalPadding="none"
              border={index === 0 ? "none" : "indented"}
              left={
                <Checkbox
                  id={`${helpId}-${task.id}`}
                  ref={index === 0 ? firstInputRef : undefined}
                  checked={selectedIds.includes(task.id)}
                  disabled={saving}
                  onCheckedChange={() => onSelect(task.id)}
                  aria-label={task.title}
                  aria-describedby={`${helpId}-${task.id}-step`}
                />
              }
              contents={
                <label
                  className="ai-recommendations__row"
                  data-disabled={saving || undefined}
                  htmlFor={`${helpId}-${task.id}`}
                >
                  <ListRow.Texts
                    top={task.title}
                    bottom={
                      <span id={`${helpId}-${task.id}-step`}>
                        {task.stepTitle}
                      </span>
                    }
                  />
                </label>
              }
            />
          </li>
        ))}
      </ul>
      {error && (
        <p className="ai-recommendations__error" role="alert">
          {error}
        </p>
      )}
      <div className="ai-recommendations__actions">
        <Button
          size="large"
          color="dark"
          variant="weak"
          disabled={saving}
          onClick={() => {
            restoreFocus.current = true;
            onDismiss();
          }}
        >
          건너뛰기
        </Button>
        <Button
          size="large"
          loading={saving}
          disabled={!selectedIds.length}
          onClick={() => {
            restoreFocus.current = true;
            onAdd();
          }}
        >
          {error ? "저장 다시 시도" : `${selectedIds.length}개 추가`}
        </Button>
      </div>
    </section>
  );
}
