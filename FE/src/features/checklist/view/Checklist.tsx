import { MouseEvent, useEffect, useRef, useState } from "react";

import { useIsMobileLayout } from "../../../shared/responsive";
import { ChecklistItemEditingController } from "../model/checklistEditing";
import { ChecklistTaskCreationController } from "../useChecklistTaskCreation";
import { ChecklistCategoryViewModel } from "../view-model/createChecklistViewModel";
import "./Checklist.css";
import { ChecklistModalDialog } from "./ChecklistModalDialog";
import { ChecklistTaskCreation } from "./ChecklistTaskCreation";
import { ChecklistTaskDetailPage } from "./ChecklistTaskDetailPage";
import { ChecklistTaskDetailPanel } from "./ChecklistTaskDetailPanel";

interface ChecklistProps {
  categories: ChecklistCategoryViewModel[];
  isAuthenticated?: boolean;
  itemEditing?: ChecklistItemEditingController;
  onBackTaskDetail: () => void;
  onCloseTaskDetail: () => void;
  onSelectTask: (taskId: string) => void;
  selectedTaskId: string | null;
  taskCreation?: ChecklistTaskCreationController;
}

function canRestoreFocus(
  button: HTMLButtonElement | null,
): button is HTMLButtonElement {
  return (
    button !== null &&
    button.isConnected &&
    !button.disabled &&
    button.closest("[hidden]") === null
  );
}

export function Checklist({
  categories,
  isAuthenticated = false,
  itemEditing,
  onBackTaskDetail,
  onCloseTaskDetail,
  onSelectTask,
  selectedTaskId,
  taskCreation,
}: ChecklistProps) {
  const [expandedCategoryIds, setExpandedCategoryIds] = useState(
    () =>
      new Set(
        categories
          .filter((category) => category.expanded)
          .map((category) => category.id),
      ),
  );
  const isMobileLayout = useIsMobileLayout();
  const fallbackFocusRef = useRef<HTMLButtonElement>(null);
  const addTaskButtonRef = useRef<HTMLButtonElement>(null);
  const wasTaskCreationOpenRef = useRef(taskCreation?.isOpen ?? false);
  const previousSelectedTaskIdRef = useRef(selectedTaskId);
  const selectedTaskButtonRef = useRef<HTMLButtonElement | null>(null);
  const taskButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const selectedTaskContext = categories
    .flatMap((category) =>
      category.tasks.map((task) => ({ categoryTitle: category.title, task })),
    )
    .find(({ task }) => task.id === selectedTaskId);
  const tasks = categories.flatMap((category) => category.tasks);
  const completedTaskCount = tasks.filter(
    (task) => task.status === "complete",
  ).length;
  const isTaskCreationOpen = taskCreation?.isOpen ?? false;

  useEffect(() => {
    const previousSelectedTaskId = previousSelectedTaskIdRef.current;

    if (previousSelectedTaskId !== null && selectedTaskId === null) {
      const previousTaskButton =
        taskButtonRefs.current.get(previousSelectedTaskId) ??
        selectedTaskButtonRef.current;

      if (canRestoreFocus(previousTaskButton)) {
        previousTaskButton.focus();
      } else {
        fallbackFocusRef.current?.focus();
      }
    }

    selectedTaskButtonRef.current = selectedTaskContext
      ? (taskButtonRefs.current.get(selectedTaskContext.task.id) ?? null)
      : null;
    previousSelectedTaskIdRef.current = selectedTaskId;
  }, [selectedTaskContext, selectedTaskId]);

  useEffect(() => {
    if (
      wasTaskCreationOpenRef.current &&
      !isTaskCreationOpen &&
      !selectedTaskContext
    ) {
      addTaskButtonRef.current?.focus();
    }

    wasTaskCreationOpenRef.current = isTaskCreationOpen;
  }, [isTaskCreationOpen, selectedTaskContext]);

  useEffect(() => {
    if (!selectedTaskContext) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isMobileLayout) {
          onBackTaskDetail();
        } else {
          onCloseTaskDetail();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isMobileLayout,
    onBackTaskDetail,
    onCloseTaskDetail,
    selectedTaskContext,
  ]);

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
    onSelectTask(taskId);
  };

  const openTaskCreation = () => {
    if (!taskCreation) {
      return;
    }

    taskCreation.open();
  };

  const isMobileForegroundOpen =
    isMobileLayout && (selectedTaskContext !== undefined || isTaskCreationOpen);
  const isLoginRequiredOpen = taskCreation?.isLoginRequiredOpen ?? false;

  return (
    <div
      className={`checklist-workspace${
        isTaskCreationOpen && !isMobileLayout
          ? " checklist-workspace--add-open"
          : selectedTaskContext && !isMobileLayout
            ? " checklist-workspace--detail-open"
            : ""
      }${
        selectedTaskContext && isMobileLayout
          ? " checklist-workspace--mobile-detail-open"
          : ""
      }`}
    >
      <div
        aria-hidden={
          isMobileForegroundOpen || isLoginRequiredOpen ? true : undefined
        }
        className="checklist-workspace__main"
        inert={isMobileForegroundOpen || isLoginRequiredOpen ? true : undefined}
      >
        <div aria-label="결혼 준비 체크리스트" className="checklist">
          <header className="checklist__toolbar">
            <div className="checklist__summary">
              <h1>체크리스트</h1>
              <p>
                {isAuthenticated
                  ? `전체 ${tasks.length}개 · 완료 ${completedTaskCount}개`
                  : "기기에서 저장 중"}
              </p>
            </div>
            <button
              className="checklist__add-task"
              onClick={() => {
                addTaskButtonRef.current?.focus();
                openTaskCreation();
              }}
              ref={addTaskButtonRef}
              type="button"
            >
              <span aria-hidden="true">＋</span>할 일 추가
            </button>
          </header>

          {categories.map((category, categoryIndex) => {
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
                    ref={categoryIndex === 0 ? fallbackFocusRef : undefined}
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
                          aria-controls={
                            isMobileLayout
                              ? "checklist-task-detail-page"
                              : "checklist-task-detail-panel"
                          }
                          aria-expanded={isSelected}
                          className="checklist__task-button"
                          onClick={(event) => selectTask(task.id, event)}
                          ref={(button) => {
                            if (button) {
                              taskButtonRefs.current.set(task.id, button);
                            } else {
                              taskButtonRefs.current.delete(task.id);
                            }
                          }}
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

      {selectedTaskContext && !isMobileLayout && !isTaskCreationOpen ? (
        <ChecklistTaskDetailPanel
          categories={categories}
          categoryTitle={selectedTaskContext.categoryTitle}
          editing={itemEditing}
          onClose={onCloseTaskDetail}
          task={selectedTaskContext.task}
        />
      ) : null}

      {selectedTaskContext && isMobileLayout && !isTaskCreationOpen ? (
        <ChecklistTaskDetailPage
          categories={categories}
          categoryTitle={selectedTaskContext.categoryTitle}
          editing={itemEditing}
          onBack={onBackTaskDetail}
          task={selectedTaskContext.task}
        />
      ) : null}

      {taskCreation && isTaskCreationOpen ? (
        <ChecklistTaskCreation
          categories={categories}
          controller={taskCreation}
        />
      ) : null}

      {taskCreation?.isLoginRequiredOpen ? (
        <ChecklistModalDialog
          actions={
            <>
              <button
                className="checklist-dialog__button checklist-dialog__button--secondary"
                onClick={taskCreation.cancelLoginRequired}
                type="button"
              >
                취소
              </button>
              <button
                className="checklist-dialog__button checklist-dialog__button--primary"
                onClick={taskCreation.visitLogin}
                type="button"
              >
                로그인
              </button>
            </>
          }
          description={
            "나만의 할 일을 추가하려면 로그인해 주세요.\n로그인 후 체크리스트에서 계속할 수 있어요."
          }
          onEscape={taskCreation.cancelLoginRequired}
          title="로그인이 필요해요"
        />
      ) : null}
    </div>
  );
}
