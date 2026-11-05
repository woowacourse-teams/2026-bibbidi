import { useId, useEffect, useRef, useState, type CSSProperties } from "react";

import cardSurface from "../../../assets/ai-chat/recommendation-card.svg";
import peekSurface from "../../../assets/ai-chat/recommendation-peek.svg";
import stepSurface from "../../../assets/ai-chat/recommendation-step.svg";
import peekStepSurface from "../../../assets/ai-chat/recommendation-peek-step.svg";
import skipSurface from "../../../assets/ai-chat/recommendation-skip.svg";
import addSurface from "../../../assets/ai-chat/recommendation-add.svg";
import type {
  RecommendedTask,
  AnswerRecommendations,
} from "../model/recommendation";
import { useRecommendationSwipe } from "../hooks/useRecommendationSwipe";
import { AiChatRecommendationComplete } from "./AiChatAssistantMessage";
import "./AiChatRecommendations.css";

function CardContent({
  task,
  peek = false,
}: {
  task: RecommendedTask;
  peek?: boolean;
}) {
  return (
    <>
      <img
        alt=""
        className="ai-recommendations__surface"
        draggable={false}
        src={peek ? peekSurface : cardSurface}
      />
      <span className="ai-recommendations__number">
        {String(task.order).padStart(2, "0")}
      </span>
      <strong className="ai-recommendations__title">{task.title}</strong>
      <span className="ai-recommendations__step">
        <img
          alt=""
          draggable={false}
          src={peek ? peekStepSurface : stepSurface}
        />
        <span title={task.stepTitle}>{task.stepTitle}</span>
      </span>
      <span className="ai-recommendations__description">
        내 로드맵의 세부 할 일로
        <br />
        추가할 수 있어요.
      </span>
    </>
  );
}

export function AiChatRecommendations({
  tasks,
  selectedId,
  status,
  saving,
  error,
  onSelect,
  onSkip,
  onAdd,
  onRetry,
}: AnswerRecommendations & {
  status: "loading" | "error" | "ready";
  onRetry: () => void;
}) {
  const helpId = useId();
  const layerRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLButtonElement>(null);
  const completeRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  const [entryDirection, setEntryDirection] = useState(1);
  const current = Math.max(
    0,
    tasks.findIndex((task) => task.id === selectedId),
  );
  const task = tasks[current];
  useEffect(() => {
    if (!saving && restoreFocus.current) {
      (cardRef.current ?? completeRef.current)?.focus({ preventScroll: true });
      restoreFocus.current = false;
    }
  }, [saving, task?.id]);
  useEffect(() => {
    errorRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [error, status]);
  const add = () => {
    restoreFocus.current = true;
    onAdd(task.id);
  };
  const skip = () => {
    restoreFocus.current = true;
    onSkip(task.id);
  };
  const previous =
    tasks.length > 1
      ? tasks[(current - 1 + tasks.length) % tasks.length]
      : undefined;
  const next =
    tasks.length > 1 ? tasks[(current + 1) % tasks.length] : undefined;
  const {
    drag,
    direction,
    slotStyle,
    layerStyle,
    cardStyle,
    reset,
    pointerHandlers,
  } = useRecommendationSwipe({ layerRef, saving, onSkip: skip, onAdd: add });

  if (status === "loading")
    return <p role="status">추천 카드를 불러오고 있어요.</p>;
  if (status === "error")
    return (
      <div className="ai-chat__error" role="alert" ref={errorRef}>
        <p>추천 카드를 불러오지 못했어요.</p>
        <button onClick={onRetry} type="button">
          카드 다시 불러오기
        </button>
      </div>
    );
  if (!task) return <AiChatRecommendationComplete ref={completeRef} />;

  return (
    <div className="ai-recommendations-slot" style={slotStyle}>
      <section
        aria-label="추천 할 일"
        aria-busy={saving}
        className={`ai-recommendations${drag !== null ? " ai-recommendations--pressed" : ""}`}
        popover="manual"
        ref={layerRef}
        style={layerStyle}
      >
        <header className="ai-recommendations__header">
          <strong>추천 할 일</strong>
          <span aria-live="polite">
            {current + 1} / {tasks.length}
          </span>
        </header>
        <p className="ai-recommendations__direction" aria-hidden="true">
          {drag !== null
            ? "← 스킵 · 좌우로 드래그 · 추가 →"
            : "옆 카드를 누르면 다른 추천을 볼 수 있어요."}
        </p>
        <div className="ai-recommendations__stage">
          {([previous, next] as const).map((side, index) =>
            side ? (
              <button
                aria-label={`${index === 0 ? "이전" : "다음"} 추천: ${side.title}`}
                className={`ai-recommendations__peek ai-recommendations__peek--${index === 0 ? "previous" : "next"}`}
                disabled={saving}
                key={index}
                onClick={() => {
                  setEntryDirection(index === 0 ? -1 : 1);
                  onSelect(side.id);
                }}
                type="button"
              >
                <CardContent task={side} peek />
              </button>
            ) : null,
          )}
          <button
            aria-label={`현재 추천: ${task.title}`}
            aria-describedby={helpId}
            aria-keyshortcuts="ArrowLeft ArrowRight Delete Enter"
            className="ai-recommendations__card"
            ref={cardRef}
            disabled={saving}
            onClick={(event) => {
              if (event.detail === 0) add();
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                const target = event.key === "ArrowLeft" ? previous : next;
                if (target) {
                  restoreFocus.current = true;
                  setEntryDirection(event.key === "ArrowLeft" ? -1 : 1);
                  onSelect(target.id);
                }
              } else if (event.key === "Delete") {
                event.preventDefault();
                skip();
              } else if (event.key === "Escape") reset();
            }}
            {...pointerHandlers}
            style={
              {
                ...cardStyle,
                "--recommendation-enter-x": `${entryDirection * 40}px`,
              } as CSSProperties
            }
            type="button"
          >
            <span className="ai-recommendations__card-content" key={task.id}>
              <CardContent task={task} />
            </span>
            {direction ? (
              <span className="ai-recommendations__badge" aria-hidden="true">
                <img
                  alt=""
                  draggable={false}
                  src={direction === "skip" ? skipSurface : addSurface}
                />
                <span>{direction === "skip" ? "스킵 ←" : "추가 ✓"}</span>
              </span>
            ) : null}
            {saving ? (
              <span className="ai-recommendations__saving" role="status">
                저장 중…
              </span>
            ) : null}
          </button>
        </div>
        <p className="ai-recommendations__hint" aria-hidden="true">
          {drag !== null
            ? direction === "skip"
              ? "손을 떼면 이 추천을 스킵해요"
              : direction === "add"
                ? "손을 떼면 내 로드맵에 추가해요"
                : "손을 떼면 원래 위치로 돌아와요"
            : "중앙 카드를 누른 채 좌우로 드래그하세요"}
        </p>
        <p className="ai-chat__sr-only" id={helpId}>
          좌우 방향키로 추천 이동, Delete로 스킵, Enter 또는 스페이스로 내
          로드맵에 추가합니다.
        </p>
        {error ? (
          <div className="ai-chat__error" role="alert" ref={errorRef}>
            <p>{error}</p>
            <button disabled={saving} onClick={add} type="button">
              저장 다시 시도
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
