import { MouseEvent, useEffect, useRef, useState } from "react";

import { useIsMobileLayout } from "../../../shared/responsive";
import { ChecklistItemEditingController } from "../model/checklistEditing";
import { ChecklistAppointmentCreationController } from "../useChecklistAppointmentCreation";
import { ChecklistTaskCreationController } from "../useChecklistTaskCreation";
import { ChecklistCategoryViewModel } from "../view-model/createChecklistViewModel";
import "./Checklist.css";
import { ChecklistAppointmentCreation } from "./ChecklistAppointmentCreation";
import { ChecklistModalDialog } from "./ChecklistModalDialog";
import { ChecklistTaskCreation } from "./ChecklistTaskCreation";
import { ChecklistTaskDetailPage } from "./ChecklistTaskDetailPage";
import { ChecklistTaskDetailPanel } from "./ChecklistTaskDetailPanel";

interface ChecklistProps {
  appointmentCreation?: ChecklistAppointmentCreationController;
  categories: ChecklistCategoryViewModel[];
  isAuthenticated?: boolean;
  itemEditing?: ChecklistItemEditingController;
  loginRequiredReason?: "schedule-creation" | "task-creation" | null;
  onBackTaskDetail: () => void;
  onCancelLoginRequired?: () => void;
  onCloseTaskDetail: () => void;
  onOpenTaskCreation?: () => void;
  onRequestScheduleCreation?: () => void;
  onSelectTask: (taskId: string) => void;
  onVisitLogin?: () => void;
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
  appointmentCreation,
  categories,
  isAuthenticated = false,
  itemEditing,
  loginRequiredReason = null,
  onBackTaskDetail,
  onCancelLoginRequired,
  onCloseTaskDetail,
  onOpenTaskCreation,
  onRequestScheduleCreation,
  onSelectTask,
  onVisitLogin,
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
  const wasAppointmentCreationOpenRef = useRef(
    appointmentCreation?.isOpen ?? false,
  );
  const appointmentCreationTaskIdRef = useRef(
    appointmentCreation?.isOpen ? selectedTaskId : null,
  );
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
  const isAppointmentCreationOpen = appointmentCreation?.isOpen ?? false;
  const pendingStatusConfirmation = itemEditing?.statusConfirmation ?? null;
  const statusConfirmation =
    pendingStatusConfirmation?.itemId ===
    selectedTaskContext?.task.checklistItemId
      ? pendingStatusConfirmation
      : null;
  const isStatusConfirmationOpen = statusConfirmation !== null;
  const isLoginRequiredOpen = loginRequiredReason !== null;
  const statusFeedback = itemEditing?.changeFeedback;
  const isStatusChangePending =
    statusConfirmation !== null &&
    statusFeedback?.status === "pending" &&
    statusFeedback.itemId === statusConfirmation.itemId &&
    statusFeedback.kind === "status";
  const statusConfirmationError =
    statusConfirmation !== null &&
    statusFeedback?.status === "error" &&
    statusFeedback.itemId === statusConfirmation.itemId &&
    statusFeedback.kind === "status"
      ? statusFeedback.errorMessage
      : undefined;

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
    if (
      !wasAppointmentCreationOpenRef.current &&
      isAppointmentCreationOpen &&
      selectedTaskContext
    ) {
      appointmentCreationTaskIdRef.current = selectedTaskContext.task.id;
    }

    if (
      wasAppointmentCreationOpenRef.current &&
      !isAppointmentCreationOpen &&
      selectedTaskContext?.task.id === appointmentCreationTaskIdRef.current
    ) {
      document
        .getElementById(`${selectedTaskContext.task.id}-add-appointment`)
        ?.focus();
    }

    if (!isAppointmentCreationOpen) {
      appointmentCreationTaskIdRef.current = null;
    }

    wasAppointmentCreationOpenRef.current = isAppointmentCreationOpen;
  }, [isAppointmentCreationOpen, selectedTaskContext]);

  useEffect(() => {
    if (!selectedTaskContext || isAppointmentCreationOpen) {
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
    isAppointmentCreationOpen,
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

  const isMobileForegroundOpen =
    isMobileLayout && (selectedTaskContext !== undefined || isTaskCreationOpen);

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
          isMobileForegroundOpen ||
          isLoginRequiredOpen ||
          isStatusConfirmationOpen
            ? true
            : undefined
        }
        className="checklist-workspace__main"
        inert={
          isMobileForegroundOpen ||
          isLoginRequiredOpen ||
          isStatusConfirmationOpen
            ? true
            : undefined
        }
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
                onOpenTaskCreation?.();
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

      <div
        aria-hidden={
          isLoginRequiredOpen || isStatusConfirmationOpen ? true : undefined
        }
        className="checklist-workspace__foreground"
        inert={
          isLoginRequiredOpen || isStatusConfirmationOpen ? true : undefined
        }
      >
        {selectedTaskContext &&
        !isMobileLayout &&
        !isTaskCreationOpen &&
        !isAppointmentCreationOpen ? (
          <ChecklistTaskDetailPanel
            categories={categories}
            categoryTitle={selectedTaskContext.categoryTitle}
            editing={itemEditing}
            onClose={onCloseTaskDetail}
            onRequestScheduleCreation={onRequestScheduleCreation}
            task={selectedTaskContext.task}
          />
        ) : null}

        {selectedTaskContext &&
        isMobileLayout &&
        !isTaskCreationOpen &&
        !isAppointmentCreationOpen ? (
          <ChecklistTaskDetailPage
            categories={categories}
            categoryTitle={selectedTaskContext.categoryTitle}
            editing={itemEditing}
            onBack={onBackTaskDetail}
            onRequestScheduleCreation={onRequestScheduleCreation}
            task={selectedTaskContext.task}
          />
        ) : null}

        {taskCreation && isTaskCreationOpen ? (
          <ChecklistTaskCreation
            categories={categories}
            controller={taskCreation}
          />
        ) : null}

        {selectedTaskContext &&
        appointmentCreation &&
        isAppointmentCreationOpen ? (
          <ChecklistAppointmentCreation
            controller={appointmentCreation}
            taskTitle={selectedTaskContext.task.title}
          />
        ) : null}
      </div>

      {isLoginRequiredOpen ? (
        <ChecklistModalDialog
          actions={
            <>
              <button
                className="checklist-dialog__button checklist-dialog__button--secondary"
                onClick={onCancelLoginRequired}
                type="button"
              >
                취소
              </button>
              <button
                className="checklist-dialog__button checklist-dialog__button--primary"
                onClick={onVisitLogin}
                type="button"
              >
                로그인
              </button>
            </>
          }
          description={
            loginRequiredReason === "schedule-creation"
              ? "일정을 추가하려면 로그인해 주세요.\n로그인 후 체크리스트에서 계속할 수 있어요."
              : "나만의 할 일을 추가하려면 로그인해 주세요.\n로그인 후 체크리스트에서 계속할 수 있어요."
          }
          onBackdropPress={onCancelLoginRequired}
          onEscape={onCancelLoginRequired}
          title="로그인이 필요해요"
        />
      ) : null}

      {statusConfirmation ? (
        <ChecklistModalDialog
          actions={
            <>
              <button
                disabled={isStatusChangePending}
                onClick={() =>
                  itemEditing?.cancelStatusChange(statusConfirmation.itemId)
                }
                type="button"
              >
                취소
              </button>
              <button
                disabled={isStatusChangePending}
                onClick={() =>
                  void itemEditing?.confirmStatusChange(
                    statusConfirmation.itemId,
                  )
                }
                type="button"
              >
                {isStatusChangePending ? "변경 중" : "함께 완료"}
              </button>
            </>
          }
          description={
            <>
              이 할 일을 완료하면 아직 남아 있는 일정도 함께 완료돼요.
              {statusConfirmationError ? (
                <p role="alert">{statusConfirmationError}</p>
              ) : null}
            </>
          }
          onEscape={() => {
            if (!isStatusChangePending) {
              itemEditing?.cancelStatusChange(statusConfirmation.itemId);
            }
          }}
          title="남은 일정도 완료할까요?"
        />
      ) : null}
    </div>
  );
}
