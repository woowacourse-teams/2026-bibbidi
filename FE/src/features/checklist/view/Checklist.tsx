import {
  MouseEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { useIsMobileLayout } from "../../../shared/responsive";
import { ChecklistItemEditingController } from "../model/checklistEditing";
import { ChecklistAppointmentCreationController } from "../useChecklistAppointmentCreation";
import { ChecklistAppointmentManagementController } from "../useChecklistAppointmentManagement";
import { ChecklistTaskCreationController } from "../useChecklistTaskCreation";
import { ChecklistCategoryViewModel } from "../view-model/createChecklistViewModel";
import "./Checklist.css";
import { ChecklistAppointmentCreation } from "./ChecklistAppointmentCreation";
import { ChecklistModalDialog } from "./ChecklistModalDialog";
import { ChecklistTaskCreation } from "./ChecklistTaskCreation";
import { ChecklistTaskDetailBottomSheet } from "./ChecklistTaskDetailBottomSheet";
import { ChecklistTaskDetailPanel } from "./ChecklistTaskDetailPanel";

interface ChecklistProps {
  appointmentCreation?: ChecklistAppointmentCreationController;
  appointmentManagement?: ChecklistAppointmentManagementController;
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
  onVisitPreparation?: (categoryId: string) => void;
  onVisitLogin?: () => void;
  revealCustomCategory?: { categoryId: string; requestId: number } | null;
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
  appointmentManagement,
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
  onVisitPreparation,
  onVisitLogin,
  revealCustomCategory = null,
  selectedTaskId,
  taskCreation,
}: ChecklistProps) {
  const [expandedGroupIds, setExpandedGroupIds] = useState(
    () =>
      new Set(
        categories.flatMap((category) =>
          category.groups
            .filter((group) => group.expanded)
            .map((group) => group.id),
        ),
      ),
  );
  const [collapsedRevealRequestId, setCollapsedRevealRequestId] = useState<
    number | null
  >(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    () =>
      categories.find((category) =>
        category.tasks.some((task) => task.id === selectedTaskId),
      )?.id ??
      categories[0]?.id ??
      null,
  );
  const [dismissedRevealRequestId, setDismissedRevealRequestId] = useState<
    number | null
  >(null);
  const isMobileLayout = useIsMobileLayout();
  const checklistRef = useRef<HTMLDivElement>(null);
  const fallbackFocusRef = useRef<HTMLButtonElement>(null);
  const addTaskButtonRef = useRef<HTMLButtonElement>(null);
  const toolbarRef = useRef<HTMLElement>(null);
  const wasTaskCreationOpenRef = useRef(taskCreation?.isOpen ?? false);
  const wasAppointmentCreationOpenRef = useRef(
    appointmentCreation?.isOpen ?? false,
  );
  const appointmentCreationTaskIdRef = useRef(
    appointmentCreation?.isOpen ? selectedTaskId : null,
  );
  const wasAppointmentEditingOpenRef = useRef(
    appointmentManagement?.editing.isOpen ?? false,
  );
  const appointmentEditingIdRef = useRef<number | null>(null);
  const wasDeletionOpenRef = useRef(
    appointmentManagement?.deletionConfirmation !== null,
  );
  const deletionAppointmentIdRef = useRef<number | null>(null);
  const previousSelectedTaskIdRef = useRef(selectedTaskId);
  const selectedTaskButtonRef = useRef<HTMLButtonElement | null>(null);
  const taskButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const selectedTaskContext = categories
    .flatMap((category) =>
      category.tasks.map((task) => ({ categoryTitle: category.title, task })),
    )
    .find(({ task }) => task.id === selectedTaskId);
  const revealedCategoryId =
    revealCustomCategory?.requestId === dismissedRevealRequestId
      ? null
      : revealCustomCategory?.categoryId;
  const selectedCategory =
    categories.find(
      (category) => category.id === selectedTaskContext?.task.categoryId,
    ) ??
    categories.find((category) => category.id === revealedCategoryId) ??
    categories.find((category) => category.id === selectedCategoryId) ??
    categories[0];
  const revealCustomGroupId = categories
    .find((category) => category.id === revealCustomCategory?.categoryId)
    ?.groups.find((group) => group.isCustom)?.id;
  const tasks = selectedCategory?.tasks ?? [];
  const completedTaskCount = selectedCategory?.completedCount ?? 0;
  const isTaskCreationOpen = taskCreation?.isOpen ?? false;
  const isAppointmentCreationOpen = appointmentCreation?.isOpen ?? false;
  const isAppointmentEditingOpen =
    appointmentManagement?.editing.isOpen ?? false;
  const deletionConfirmation =
    appointmentManagement?.deletionConfirmation ?? null;
  const isAppointmentDeletionOpen = deletionConfirmation !== null;
  const appointmentOperationFeedback = appointmentManagement?.operationFeedback;
  const isAppointmentDeletionPending =
    deletionConfirmation !== null &&
    appointmentOperationFeedback?.status === "pending" &&
    appointmentOperationFeedback.operation === "delete" &&
    appointmentOperationFeedback.appointmentId ===
      deletionConfirmation.appointmentId;
  const appointmentDeletionError =
    deletionConfirmation !== null &&
    appointmentOperationFeedback?.status === "error" &&
    appointmentOperationFeedback.operation === "delete" &&
    appointmentOperationFeedback.appointmentId ===
      deletionConfirmation.appointmentId
      ? appointmentOperationFeedback.errorMessage
      : undefined;
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

  useLayoutEffect(() => {
    const checklist = checklistRef.current;
    const toolbar = toolbarRef.current;

    if (!checklist || !toolbar) {
      return;
    }

    const updateToolbarHeight = () => {
      const toolbarHeight = toolbar.getBoundingClientRect().height;

      if (toolbarHeight > 0) {
        checklist.style.setProperty(
          "--checklist-toolbar-height",
          `${toolbarHeight}px`,
        );
      }
    };

    updateToolbarHeight();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(updateToolbarHeight);
    resizeObserver.observe(toolbar);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const previousSelectedTaskId = previousSelectedTaskIdRef.current;

    if (previousSelectedTaskId !== null && selectedTaskId === null) {
      const previousTaskButton =
        taskButtonRefs.current.get(previousSelectedTaskId) ??
        selectedTaskButtonRef.current;

      if (canRestoreFocus(previousTaskButton)) {
        previousTaskButton.focus();
      } else {
        (fallbackFocusRef.current ?? addTaskButtonRef.current)?.focus();
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
    if (
      !wasAppointmentEditingOpenRef.current &&
      isAppointmentEditingOpen &&
      selectedTaskContext
    ) {
      appointmentEditingIdRef.current =
        appointmentManagement?.editingAppointmentId ?? null;
    }

    if (wasAppointmentEditingOpenRef.current && !isAppointmentEditingOpen) {
      const appointmentId = appointmentEditingIdRef.current;
      if (appointmentId !== null) {
        document
          .getElementById(`${appointmentId}-appointment-menu-button`)
          ?.focus();
      }
    }

    if (!isAppointmentEditingOpen) {
      appointmentEditingIdRef.current = null;
    }
    wasAppointmentEditingOpenRef.current = isAppointmentEditingOpen;
  }, [appointmentManagement, isAppointmentEditingOpen, selectedTaskContext]);

  useEffect(() => {
    if (!wasDeletionOpenRef.current && deletionConfirmation) {
      deletionAppointmentIdRef.current = deletionConfirmation.appointmentId;
    }

    if (wasDeletionOpenRef.current && !deletionConfirmation) {
      const trigger =
        deletionAppointmentIdRef.current === null
          ? null
          : document.getElementById(
              `${deletionAppointmentIdRef.current}-appointment-menu-button`,
            );
      (
        trigger ??
        document.getElementById(
          `${selectedTaskContext?.task.id}-add-appointment`,
        )
      )?.focus();
      deletionAppointmentIdRef.current = null;
    }

    wasDeletionOpenRef.current = deletionConfirmation !== null;
  }, [deletionConfirmation, selectedTaskContext]);

  useEffect(() => {
    if (
      !selectedTaskContext ||
      isAppointmentCreationOpen ||
      isAppointmentEditingOpen ||
      isAppointmentDeletionOpen ||
      isMobileLayout
    ) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseTaskDetail();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isAppointmentCreationOpen,
    isAppointmentDeletionOpen,
    isAppointmentEditingOpen,
    isMobileLayout,
    onCloseTaskDetail,
    selectedTaskContext,
  ]);

  const toggleGroup = (groupId: string, isExpanded: boolean) => {
    setExpandedGroupIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (isExpanded) {
        nextIds.delete(groupId);
      } else {
        nextIds.add(groupId);
      }

      return nextIds;
    });

    if (isExpanded && groupId === revealCustomGroupId && revealCustomCategory) {
      setCollapsedRevealRequestId(revealCustomCategory.requestId);
    }
  };

  const selectCategory = (categoryId: string) => {
    if (categoryId === selectedCategory?.id) {
      return;
    }

    setSelectedCategoryId(categoryId);
    setDismissedRevealRequestId(revealCustomCategory?.requestId ?? null);
    onCloseTaskDetail();
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
      }`}
    >
      <div
        aria-hidden={
          isMobileForegroundOpen ||
          isLoginRequiredOpen ||
          isStatusConfirmationOpen ||
          isAppointmentDeletionOpen
            ? true
            : undefined
        }
        className="checklist-workspace__main"
        inert={
          isMobileForegroundOpen ||
          isLoginRequiredOpen ||
          isStatusConfirmationOpen ||
          isAppointmentDeletionOpen
            ? true
            : undefined
        }
      >
        <div className="checklist-layout">
          <nav aria-label="체크리스트 대분류" className="checklist-categories">
            <ul className="checklist-categories__list">
              {categories.map((category) => {
                const isCurrent = category.id === selectedCategory?.id;

                return (
                  <li key={category.id}>
                    <button
                      aria-controls="checklist-category-content"
                      aria-label={`${category.title} ${category.countLabel}`}
                      aria-pressed={isCurrent}
                      className={`checklist-categories__button${
                        isCurrent
                          ? " checklist-categories__button--current"
                          : ""
                      }`}
                      onClick={() => selectCategory(category.id)}
                      type="button"
                    >
                      <span>{category.title}</span>
                      <span className="checklist-categories__count">
                        {category.countLabel}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <main
            aria-label="결혼 준비 체크리스트"
            className="checklist"
            id="checklist-category-content"
            ref={checklistRef}
          >
            <header className="checklist__toolbar" ref={toolbarRef}>
              <div className="checklist__summary">
                <h1>{selectedCategory?.title ?? "체크리스트"}</h1>
                <p>
                  {isAuthenticated
                    ? `전체 ${tasks.length}개 · 완료 ${completedTaskCount}개`
                    : "로그인하면 체크리스트가 그대로 저장돼요."}
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

            {selectedCategory && tasks.length === 0 ? (
              <section className="checklist__empty">
                <h2>아직 담은 할 일이 없어요</h2>
                <p>준비 목록에서 추천 할 일을 고르거나 직접 추가해 보세요.</p>
                <div className="checklist__empty-actions">
                  <button
                    className="checklist__empty-primary"
                    onClick={() => onVisitPreparation?.(selectedCategory.id)}
                    type="button"
                  >
                    준비 목록에서 추가
                  </button>
                  <button
                    className="checklist__empty-secondary"
                    onClick={onOpenTaskCreation}
                    type="button"
                  >
                    직접 추가
                  </button>
                </div>
              </section>
            ) : (
              <div className="checklist__groups">
                {selectedCategory?.groups.map((group, groupIndex) => {
                  const isExpanded =
                    expandedGroupIds.has(group.id) ||
                    (group.id === revealCustomGroupId &&
                      revealCustomCategory?.requestId !==
                        collapsedRevealRequestId);
                  const taskListId = `${group.id}-tasks`;

                  return (
                    <section
                      aria-labelledby={`${group.id}-title`}
                      className="checklist__group"
                      key={group.id}
                    >
                      <h2 className="checklist__group-heading">
                        <button
                          aria-controls={taskListId}
                          aria-expanded={isExpanded}
                          aria-label={`${group.numberLabel} ${group.title}, ${group.countLabel}, 진행률 ${group.progressLabel}`}
                          className="checklist__group-header"
                          onClick={() => toggleGroup(group.id, isExpanded)}
                          ref={groupIndex === 0 ? fallbackFocusRef : undefined}
                          type="button"
                        >
                          <span className="checklist__group-copy">
                            <span className="checklist__group-number">
                              {group.numberLabel}
                            </span>
                            <span className="checklist__group-title-area">
                              <span
                                className="checklist__group-title"
                                id={`${group.id}-title`}
                              >
                                {group.title}
                              </span>
                              <span className="checklist__group-count">
                                {group.countLabel}
                              </span>
                            </span>
                          </span>

                          <span className="checklist__progress-area">
                            <span
                              aria-label={`${group.title} 진행률`}
                              aria-valuemax={100}
                              aria-valuemin={0}
                              aria-valuenow={group.progress}
                              className="checklist__progress"
                              role="progressbar"
                            >
                              <span
                                className="checklist__progress-fill"
                                style={{ width: `${group.progress}%` }}
                              />
                            </span>
                            <span className="checklist__progress-label">
                              {group.progressLabel}
                            </span>
                            <span
                              aria-hidden="true"
                              className={`checklist__disclosure${
                                isExpanded
                                  ? " checklist__disclosure--expanded"
                                  : ""
                              }`}
                            >
                              ›
                            </span>
                          </span>
                        </button>
                      </h2>

                      <ul
                        aria-label={`${group.title} 할 일`}
                        className="checklist__tasks"
                        hidden={!isExpanded}
                        id={taskListId}
                      >
                        {group.tasks.map((task) => {
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
                                    ? "checklist-task-detail-bottom-sheet"
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
            )}
          </main>
        </div>
      </div>

      <div
        aria-hidden={
          isLoginRequiredOpen ||
          isStatusConfirmationOpen ||
          isAppointmentDeletionOpen
            ? true
            : undefined
        }
        className="checklist-workspace__foreground"
        inert={
          isLoginRequiredOpen ||
          isStatusConfirmationOpen ||
          isAppointmentDeletionOpen
            ? true
            : undefined
        }
      >
        {selectedTaskContext &&
        !isMobileLayout &&
        !isTaskCreationOpen &&
        !isAppointmentCreationOpen &&
        !isAppointmentEditingOpen ? (
          <ChecklistTaskDetailPanel
            appointmentManagement={appointmentManagement}
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
        !isAppointmentCreationOpen &&
        !isAppointmentEditingOpen ? (
          <ChecklistTaskDetailBottomSheet
            appointmentManagement={appointmentManagement}
            categories={categories}
            categoryTitle={selectedTaskContext.categoryTitle}
            editing={itemEditing}
            onClose={onBackTaskDetail}
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

        {selectedTaskContext &&
        appointmentManagement &&
        isAppointmentEditingOpen ? (
          <ChecklistAppointmentCreation
            controller={appointmentManagement.editing}
            heading="일정 수정"
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

      {deletionConfirmation && appointmentManagement ? (
        <ChecklistModalDialog
          actions={
            <>
              <button
                disabled={isAppointmentDeletionPending}
                onClick={appointmentManagement.cancelDelete}
                type="button"
              >
                취소
              </button>
              <button
                aria-busy={isAppointmentDeletionPending}
                disabled={isAppointmentDeletionPending}
                onClick={() => void appointmentManagement.confirmDelete()}
                type="button"
              >
                {isAppointmentDeletionPending ? "삭제 중" : "삭제"}
              </button>
            </>
          }
          description={
            <>
              삭제한 일정은 다시 복구할 수 없어요.
              {appointmentDeletionError ? (
                <p role="alert">{appointmentDeletionError}</p>
              ) : null}
            </>
          }
          onBackdropPress={
            isAppointmentDeletionPending
              ? undefined
              : appointmentManagement.cancelDelete
          }
          onEscape={
            isAppointmentDeletionPending
              ? undefined
              : appointmentManagement.cancelDelete
          }
          title="이 일정을 삭제할까요?"
          variant="critical"
        />
      ) : null}
    </div>
  );
}
