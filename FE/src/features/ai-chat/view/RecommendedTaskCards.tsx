import { useRef, useState } from "react";

import { recommendedTasks } from "../model/exampleChat";

export function RecommendedTaskCards({
  cardIndex,
  feedback,
  onChoose,
}: {
  cardIndex: number;
  feedback: string;
  onChoose: (add: boolean) => void;
}) {
  const gesture = useRef<{ x: number; y: number; pointerId: number } | null>(
    null,
  );
  const [offset, setOffset] = useState(0);
  const task = recommendedTasks[cardIndex];
  const resetDrag = () => {
    gesture.current = null;
    setOffset(0);
  };

  return (
    <section aria-label="추천 할 일" className="ai-chat-cards">
      {task ? (
        <>
          <div className="ai-chat-cards__heading">
            <h3>추천 할 일</h3>
            <span>
              {cardIndex + 1} / {recommendedTasks.length}
            </span>
          </div>
          <div className="ai-chat-cards__stack">
            <article
              aria-label={task.title}
              className="ai-chat-cards__card"
              onPointerCancel={resetDrag}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                gesture.current = {
                  x: event.clientX,
                  y: event.clientY,
                  pointerId: event.pointerId,
                };
                event.currentTarget.setPointerCapture?.(event.pointerId);
              }}
              onPointerMove={(event) => {
                const start = gesture.current;
                if (!start || start.pointerId !== event.pointerId) return;
                const dx = event.clientX - start.x;
                if (Math.abs(dx) > Math.abs(event.clientY - start.y)) {
                  setOffset(Math.max(-120, Math.min(120, dx)));
                }
              }}
              onPointerUp={(event) => {
                const start = gesture.current;
                resetDrag();
                if (!start || start.pointerId !== event.pointerId) return;
                const dx = event.clientX - start.x;
                if (
                  Math.abs(dx) >= 48 &&
                  Math.abs(dx) > Math.abs(event.clientY - start.y) * 1.5
                ) {
                  onChoose(dx > 0);
                }
              }}
              style={{
                transform: `translateX(${offset}px) rotate(${offset / 16}deg)`,
              }}
            >
              {Math.abs(offset) > 24 ? (
                <span className="ai-chat-cards__direction">
                  {offset > 0 ? "추가하기 →" : "← 넘기기"}
                </span>
              ) : null}
              <span className="ai-chat-cards__number">
                {String(cardIndex + 1).padStart(2, "0")}
              </span>
              <h4>{task.title}</h4>
              <p>{task.step}</p>
              <small>이 단계의 세부 할 일을 확인해보세요.</small>
            </article>
          </div>
          <div className="ai-chat-cards__actions">
            <button onClick={() => onChoose(false)} type="button">
              ← 넘기기
            </button>
            <span>좌우로 밀어 선택</span>
            <button onClick={() => onChoose(true)} type="button">
              추가하기 →
            </button>
          </div>
        </>
      ) : (
        <p className="ai-chat-cards__complete">추천 할 일을 모두 확인했어요.</p>
      )}
      <p className="ai-chat-cards__feedback" role="status">
        {feedback}
      </p>
    </section>
  );
}
