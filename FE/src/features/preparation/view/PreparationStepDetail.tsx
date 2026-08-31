import { useEffect, useRef } from "react";
import { PreparationStepDetailViewModel } from "../view-model/createPreparationRoadmapViewModel";

interface PreparationStepDetailProps {
  detail: PreparationStepDetailViewModel;
  focusOnMount?: boolean;
}

export function PreparationStepDetail({
  detail,
  focusOnMount = false,
}: PreparationStepDetailProps) {
  const detailRef = useRef<HTMLElement>(null);

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
          <span className="preparation-step-detail__category">
            {detail.categoryLabel}
          </span>
          <h2>{detail.title}</h2>
          <p>{detail.description}</p>
          <span
            className={`preparation-step-detail__status preparation-step-detail__status--${detail.status}`}
          >
            {detail.statusLabel}
          </span>
        </header>

        <div aria-hidden="true" className="preparation-step-detail__divider" />

        <ul className="preparation-step-detail__tasks">
          {detail.tasks.map((task) => (
            <li key={task.id}>
              <span aria-hidden="true" />
              {task.title}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
