import { MouseEvent, useEffect, useRef, useState } from "react";

import { ChecklistCategoryViewModel } from "../view-model/createChecklistViewModel";
import "./Checklist.css";
import { ChecklistTaskDetailPanel } from "./ChecklistTaskDetailPanel";

interface ChecklistProps {
  categories: ChecklistCategoryViewModel[];
}

const desktopDetailPanelQuery = "(min-width: 761px)";

function supportsDesktopDetailPanel() {
  return (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function" ||
    window.matchMedia(desktopDetailPanelQuery).matches
  );
}

export function Checklist({ categories }: ChecklistProps) {
  const [expandedCategoryIds, setExpandedCategoryIds] = useState(
    () =>
      new Set(
        categories
          .filter((category) => category.expanded)
          .map((category) => category.id),
      ),
  );
  const [isDesktopDetailPanelSupported, setIsDesktopDetailPanelSupported] =
    useState(supportsDesktopDetailPanel);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTaskButtonRef = useRef<HTMLButtonElement | null>(null);
  const selectedTaskContext = categories
    .flatMap((category) =>
      category.tasks.map((task) => ({ categoryTitle: category.title, task })),
    )
    .find(({ task }) => task.id === selectedTaskId);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia(desktopDetailPanelQuery);
    const handleChange = () => {
      setIsDesktopDetailPanelSupported(mediaQuery.matches);

      if (!mediaQuery.matches) {
        setSelectedTaskId(null);
      }
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!selectedTaskContext) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        selectedTaskButtonRef.current?.focus();
        setSelectedTaskId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTaskContext]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategoryIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(categoryId)) {
        nextIds.delete(categoryId);
      } else {
        nextIds.add(categoryId);
      }

      return nextIds;
    });
  };

  const selectTask = (taskId: string, event: MouseEvent<HTMLButtonElement>) => {
    selectedTaskButtonRef.current = event.currentTarget;
    setSelectedTaskId(taskId);
  };

  const closeTaskDetail = () => {
    selectedTaskButtonRef.current?.focus();
    setSelectedTaskId(null);
  };

  return (
    <div
      className={`checklist-workspace${
        selectedTaskContext && isDesktopDetailPanelSupported
          ? " checklist-workspace--detail-open"
          : ""
      }`}
    >
      <div className="checklist-workspace__main">
        <div aria-label="결혼 준비 체크리스트" className="checklist">
          {categories.map((category) => {
            const isExpanded = expandedCategoryIds.has(category.id);
            const taskListId = `${category.id}-tasks`;

            return (
              <section
                aria-labelledby={`${category.id}-title`}
                className="checklist__category"
                key={category.id}
              >
                <h2 className="checklist__category-heading">
                  <button
                    aria-controls={taskListId}
                    aria-expanded={isExpanded}
                    aria-labelledby={`${category.id}-title`}
                    className="checklist__category-header"
                    onClick={() => toggleCategory(category.id)}
                    type="button"
                  >
                    <span className="checklist__category-title-area">
                      <span
                        aria-hidden="true"
                        className={`checklist__disclosure${
                          isExpanded ? " checklist__disclosure--expanded" : ""
                        }`}
                      >
                        ›
                      </span>
                      <span
                        className="checklist__category-title"
                        id={`${category.id}-title`}
                      >
                        {category.title}
                      </span>
                      <span className="checklist__category-count">
                        {category.countLabel}
                      </span>
                    </span>

                    <span className="checklist__progress-area">
                      <span
                        aria-label={`${category.title} 진행률`}
                        aria-valuemax={100}
                        aria-valuemin={0}
                        aria-valuenow={category.progress}
                        className="checklist__progress"
                        role="progressbar"
                      >
                        <span
                          className="checklist__progress-fill"
                          style={{ width: `${category.progress}%` }}
                        />
                      </span>
                      <span className="checklist__progress-label">
                        {category.progressLabel}
                      </span>
                    </span>
                  </button>
                </h2>

                <ul
                  aria-label={`${category.title} 할 일`}
                  className="checklist__tasks"
                  hidden={!isExpanded}
                  id={taskListId}
                >
                  {category.tasks.map((task) => {
                    const isSelected = selectedTaskId === task.id;

                    return (
                      <li
                        className={`checklist__task checklist__task--${task.status}${
                          isSelected ? " checklist__task--selected" : ""
                        }`}
                        key={task.id}
                      >
                        <button
                          aria-controls="checklist-task-detail-panel"
                          aria-expanded={
                            isDesktopDetailPanelSupported && isSelected
                          }
                          className="checklist__task-button"
                          disabled={!isDesktopDetailPanelSupported}
                          onClick={(event) => selectTask(task.id, event)}
                          type="button"
                        >
                          <span
                            aria-hidden="true"
                            className="checklist__completion-mark"
                          >
                            {task.status === "complete" ? "✓" : ""}
                          </span>
                          <span className="checklist__task-title">
                            {task.title}
                          </span>
                          <span className="checklist__task-schedule">
                            {task.schedule}
                          </span>
                          <span className="checklist__task-status">
                            {task.statusLabel}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      {selectedTaskContext && isDesktopDetailPanelSupported ? (
        <ChecklistTaskDetailPanel
          categoryTitle={selectedTaskContext.categoryTitle}
          onClose={closeTaskDetail}
          task={selectedTaskContext.task}
        />
      ) : null}
    </div>
  );
}
