import { useState } from "react";

import { ChecklistCategoryViewModel } from "../view-model/createChecklistViewModel";
import "./Checklist.css";

interface ChecklistProps {
  categories: ChecklistCategoryViewModel[];
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

  return (
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
              {category.tasks.map((task) => (
                <li
                  className={`checklist__task checklist__task--${task.status}`}
                  key={task.id}
                >
                  <span
                    aria-hidden="true"
                    className="checklist__completion-mark"
                  >
                    {task.status === "complete" ? "✓" : ""}
                  </span>
                  <span className="checklist__task-title">{task.title}</span>
                  <span className="checklist__task-schedule">
                    {task.schedule}
                  </span>
                  <span className="checklist__task-status">
                    {task.statusLabel}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
