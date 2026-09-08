import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { PreparationStepDetailViewModel } from "../view-model/createPreparationRoadmapViewModel";
import {
  PreparationAddAllTasksButton,
  PreparationTaskList,
} from "./PreparationTaskList";
import "./PreparationStepInlineAccordions.css";

type AccordionValue = "available-tasks" | "checklist";

interface PreparationTaskAccordionProps {
  children: ReactNode;
  count?: number;
  isExpanded: boolean;
  onToggle: () => void;
  title: string;
}

function AccordionChevron() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function PreparationTaskAccordion({
  children,
  count,
  isExpanded,
  onToggle,
  title,
}: PreparationTaskAccordionProps) {
  const id = useId();
  const contentId = `${id}-content`;
  const triggerId = `${id}-trigger`;

  return (
    <section className="preparation-step-accordion">
      <h3 className="preparation-step-accordion__heading">
        <button
          aria-controls={contentId}
          aria-expanded={isExpanded}
          className="preparation-step-accordion__trigger"
          id={triggerId}
          onClick={onToggle}
          type="button"
        >
          <span className="preparation-step-accordion__title">
            <span
              className={`preparation-step-accordion__chevron${isExpanded ? " preparation-step-accordion__chevron--expanded" : ""}`}
            >
              <AccordionChevron />
            </span>
            <span>{title}</span>
          </span>
          {count === undefined ? null : (
            <span className="preparation-step-accordion__count">{count}개</span>
          )}
        </button>
      </h3>

      <div
        aria-labelledby={triggerId}
        className="preparation-step-accordion__content"
        hidden={!isExpanded}
        id={contentId}
        role="region"
      >
        {children}
      </div>
    </section>
  );
}

interface PreparationStepInlineAccordionsProps {
  detail: PreparationStepDetailViewModel;
}

export function PreparationStepInlineAccordions({
  detail,
}: PreparationStepInlineAccordionsProps) {
  const [expandedValue, setExpandedValue] = useState<AccordionValue | null>(
    null,
  );
  const detailRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const detailElement = detailRef.current;

    detailElement?.focus({ preventScroll: true });
    detailElement?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }, []);

  const handleToggle = (value: AccordionValue) => {
    setExpandedValue((currentValue) => (currentValue === value ? null : value));
  };

  return (
    <aside
      aria-label="이 단계에서 준비할 일"
      aria-live="polite"
      className="preparation-step-inline-detail"
      id="preparation-step-detail"
      ref={detailRef}
      tabIndex={-1}
    >
      <header className="preparation-step-inline-detail__header">
        <h2>{detail.title}</h2>
        {detail.description ? <p>{detail.description}</p> : null}
      </header>
      <PreparationTaskAccordion
        count={detail.checklistTasks.length}
        isExpanded={expandedValue === "checklist"}
        onToggle={() => handleToggle("checklist")}
        title="내 체크리스트"
      >
        <PreparationTaskList
          density="compact"
          tasks={detail.checklistTasks}
          variant="checklist"
        />
      </PreparationTaskAccordion>
      <PreparationTaskAccordion
        isExpanded={expandedValue === "available-tasks"}
        onToggle={() => handleToggle("available-tasks")}
        title="추가할 수 있는 할 일"
      >
        <div className="preparation-step-accordion__tasks">
          <PreparationTaskList
            density="compact"
            tasks={detail.detailTasks}
            variant="available"
          />
          <PreparationAddAllTasksButton
            label="남은 할 일 모두 추가"
            size="large"
          />
        </div>
      </PreparationTaskAccordion>
    </aside>
  );
}
