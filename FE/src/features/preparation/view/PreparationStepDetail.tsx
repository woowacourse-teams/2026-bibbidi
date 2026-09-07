import { useEffect, useRef } from "react";
import {
  PreparationStepDetailViewModel,
  PreparationStepTaskViewModel,
} from "../view-model/createPreparationRoadmapViewModel";

type PreparationStepDetailContentViewModel = Pick<
  PreparationStepDetailViewModel,
  "allTasks" | "description" | "detailTasks" | "title"
>;

interface PreparationStepDetailProps {
  detail: PreparationStepDetailContentViewModel;
  focusOnMount?: boolean;
  showsTaskActions?: boolean;
}

export function PreparationStepDetail({
  detail,
  focusOnMount = false,
  showsTaskActions = false,
}: PreparationStepDetailProps) {
  const detailRef = useRef<HTMLElement>(null);
  const tasks: PreparationStepTaskViewModel[] = showsTaskActions
    ? detail.detailTasks
    : detail.allTasks;

  useEffect(() => {
    if (!focusOnMount) {
      return;
    }

    const detailElement = detailRef.current;

    detailElement?.focus({ preventScroll: true });
    detailElement?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }, [focusOnMount]);

  return (
    <aside
      aria-live="polite"
      aria-label="이 단계에서 준비할 일"
      className="preparation-step-detail"
      id="preparation-step-detail"
      ref={detailRef}
      tabIndex={focusOnMount ? -1 : undefined}
    >
      <div className="preparation-step-detail__panel">
        <header className="preparation-step-detail__header">
          <h2>{detail.title}</h2>
          <p>{detail.description}</p>
        </header>

        <div className="preparation-step-detail__content">
          <section
            aria-label="세부 할 일"
            className="preparation-step-detail__section"
          >
            {tasks.length > 0 ? (
              <ul className="preparation-step-detail__tasks">
                {tasks.map((task) => (
                  <li key={task.id}>
                    <span className="preparation-step-detail__task-title">
                      <span aria-hidden="true" />
                      <span>{task.title}</span>
                    </span>
                    {showsTaskActions ? (
                      <span className="preparation-step-detail__task-actions">
                        {task.isEssential ? (
                          <span className="preparation-task-essential-badge">
                            필수
                          </span>
                        ) : null}
                        <button
                          aria-label={`${task.title} 추가 (준비 중)`}
                          disabled
                          type="button"
                        >
                          <span aria-hidden="true">+ </span>추가
                        </button>
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="preparation-step-detail__empty">
                추가할 세부 할 일이 없어요.
              </p>
            )}
          </section>
        </div>
        {showsTaskActions ? (
          <footer className="preparation-step-detail__footer">
            <button
              disabled
              type="button"
              aria-label="모든 할 일 추가 (준비 중)"
            >
              모든 할 일 추가
            </button>
          </footer>
        ) : null}
      </div>
    </aside>
  );
}
