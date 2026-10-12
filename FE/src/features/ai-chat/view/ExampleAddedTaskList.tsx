import { useEffect, useRef, useState } from "react";

import { useMediaQuery } from "../../../shared/responsive";
import type { ExampleRecommendedTask } from "../model/exampleChat";

function ExampleTaskRow({
  task,
  active,
  complete,
  isPaused,
  reducedMotion,
  onComplete,
}: {
  task: ExampleRecommendedTask;
  active: boolean;
  complete: boolean;
  isPaused: boolean;
  reducedMotion: boolean;
  onComplete: (title: string) => void;
}) {
  const characterCountRef = useRef(0);
  const [characterCount, setCharacterCount] = useState(0);
  const characters = Array.from(task.title);

  useEffect(() => {
    if (!active || isPaused) return;
    let timer: ReturnType<typeof setTimeout>;
    const typeNext = () => {
      if (reducedMotion || characterCountRef.current >= characters.length) {
        onComplete(task.title);
        return;
      }
      characterCountRef.current += 1;
      setCharacterCount(characterCountRef.current);
      timer = setTimeout(typeNext, Math.min(36, 700 / characters.length));
    };
    timer = setTimeout(
      typeNext,
      reducedMotion ? 0 : characterCountRef.current > 0 ? 36 : 280,
    );
    return () => clearTimeout(timer);
  }, [
    active,
    isPaused,
    reducedMotion,
    characters.length,
    task.title,
    onComplete,
  ]);

  return (
    <li
      aria-label={task.title}
      className={`ai-task-preview__item${active && !reducedMotion ? " ai-task-preview__item--writing" : ""}`}
      tabIndex={-1}
    >
      <span aria-hidden="true" className="ai-task-preview__marker">
        {complete || reducedMotion ? "✓" : "+"}
      </span>
      <div>
        <p aria-hidden="true" className="ai-task-preview__title">
          {complete || reducedMotion
            ? task.title
            : characters.slice(0, characterCount).join("")}
          {active && !reducedMotion ? (
            <span className="ai-task-preview__cursor" />
          ) : null}
          {!active && !complete && !reducedMotion ? "추가 대기 중" : null}
        </p>
        <p className="ai-task-preview__step">{task.step}</p>
      </div>
    </li>
  );
}

export function ExampleAddedTaskList({
  tasks,
  visibleCount,
  focusRequest,
  isPaused,
  completedCount,
  onTaskComplete,
}: {
  tasks: ExampleRecommendedTask[];
  visibleCount: number;
  focusRequest: number;
  isPaused: boolean;
  completedCount: number;
  onTaskComplete: (title: string) => void;
}) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const listRef = useRef<HTMLUListElement>(null);
  const lastFocusRequestRef = useRef(0);

  useEffect(() => {
    if (isPaused || visibleCount === 0) return;
    const requestsFocus = lastFocusRequestRef.current !== focusRequest;
    if (!requestsFocus && completedCount >= visibleCount) return;
    const row = listRef.current?.children[
      Math.min(completedCount, visibleCount - 1)
    ] as HTMLElement | undefined;
    row?.scrollIntoView?.({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "nearest",
    });
    if (requestsFocus) {
      lastFocusRequestRef.current = focusRequest;
      row?.focus({ preventScroll: true });
    }
  }, [focusRequest, visibleCount, completedCount, isPaused, reducedMotion]);

  if (visibleCount === 0) return null;

  return (
    <section aria-label="예시로 담은 일" className="ai-task-preview">
      <header className="ai-task-preview__header">
        <h2>
          예시로 담은 일 <span>{visibleCount}개</span>
        </h2>
        <p>예시 · 저장되지 않아요</p>
      </header>
      <ul aria-label="AI가 추가한 예시 할 일" ref={listRef}>
        {tasks.slice(0, visibleCount).map((task, index) => (
          <ExampleTaskRow
            key={task.title}
            task={task}
            active={index === completedCount}
            complete={index < completedCount}
            isPaused={isPaused}
            reducedMotion={reducedMotion}
            onComplete={onTaskComplete}
          />
        ))}
      </ul>
      <p className="ai-chat__sr-only" role="status">
        {completedCount > 0
          ? `${tasks[completedCount - 1]?.title} 예시 추가 완료`
          : "할 일을 추가하고 있어요."}
      </p>
    </section>
  );
}
