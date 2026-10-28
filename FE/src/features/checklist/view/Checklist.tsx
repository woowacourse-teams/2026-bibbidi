import { MouseEvent, useEffect, useState } from "react";

import { Result } from "../../../components/result";
import { useLayerPresence } from "../../../shared/modal/useLayerPresence";
import {
  WorkspaceLayout,
  useWorkspaceLayout,
} from "../../../components/workspace-layout";
import {
  ChecklistCategories,
  getChecklistCategoryTabId,
} from "./ChecklistCategories";
import { ChecklistForeground } from "./ChecklistForeground";
import { ChecklistHeader } from "./ChecklistHeader";
import { ChecklistItemEditingController } from "../model/checklistEditing";
import { ChecklistAppointmentCreationController } from "../useChecklistAppointmentCreation";
import { ChecklistAppointmentManagementController } from "../useChecklistAppointmentManagement";
import { ChecklistTaskCreationController } from "../useChecklistTaskCreation";
import { ChecklistCategoryViewModel } from "../view-model/createChecklistViewModel";
import "./Checklist.css";
import { ChecklistAppointmentForm } from "./ChecklistAppointmentForm";
import { ChecklistTaskCreation } from "./ChecklistTaskCreation";
import { ChecklistTaskDetailBottomSheet } from "./ChecklistTaskDetailBottomSheet";
import { ChecklistConfirmations } from "./ChecklistConfirmations";
import { createChecklistConfirmationViewModel } from "../view-model/createChecklistConfirmationViewModel";
import { useChecklistFocusRestoration } from "../useChecklistFocusRestoration";
import { ChecklistTaskDetailPanel } from "./ChecklistTaskDetailPanel";
import { ChecklistGroups } from "./ChecklistGroups";

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
  const selectedTaskContext = categories
    .flatMap((category) =>
      category.tasks.map((task) => ({ categoryTitle: category.title, task })),
    )
    .find(({ task }) => task.id === selectedTaskId);
  const hasAside = selectedTaskContext !== undefined || !!taskCreation?.isOpen;
  const { present: foregroundPresent, onExited: completeForegroundExit } =
    useLayerPresence(hasAside);
  const { ref: workspaceRef, layout } = useWorkspaceLayout(
    true,
    foregroundPresent,
  );
  const isMobileLayout = layout.isMobile;
  const isOverlay =
    !isMobileLayout && layout.asidePlacement === "overlay" && foregroundPresent;
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
  const expandedGroupValues = (selectedCategory?.groups ?? [])
    .filter(
      (group) =>
        expandedGroupIds.has(group.id) ||
        (group.id === revealCustomGroupId &&
          revealCustomCategory?.requestId !== collapsedRevealRequestId),
    )
    .map((group) => group.id);
  const completedTaskCount = selectedCategory?.completedCount ?? 0;
  const isTaskCreationOpen = taskCreation?.isOpen ?? false;
  const isAppointmentCreationOpen = appointmentCreation?.isOpen ?? false;
  const isAppointmentEditingOpen =
    appointmentManagement?.editing.isOpen ?? false;
  const isAppointmentDeletionOpen =
    appointmentManagement?.deletionConfirmation != null;
  const confirmationViewModel = createChecklistConfirmationViewModel({
    selectedItemId: selectedTaskContext?.task.checklistItemId ?? null,
    itemEditing,
    appointmentManagement,
  });
  const {
    fallbackFocusRef,
    addTaskButtonRef,
    taskCreationTriggerRef,
    registerTaskButton,
    rememberTaskSelection,
    skipTaskFocusRestoration,
  } = useChecklistFocusRestoration({
    selectedTaskId,
    activeTaskId: selectedTaskContext?.task.id ?? null,
    foregroundPresent,
    isAppointmentCreationOpen,
    isAppointmentEditingOpen,
    editingAppointmentId: appointmentManagement?.editingAppointmentId ?? null,
    deletionAppointmentId:
      appointmentManagement?.deletionConfirmation?.appointmentId ?? null,
  });

  useEffect(() => {
    if (
      !selectedTaskContext ||
      isAppointmentCreationOpen ||
      isAppointmentEditingOpen ||
      isAppointmentDeletionOpen ||
      isMobileLayout ||
      isOverlay
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
    isOverlay,
    onCloseTaskDetail,
    selectedTaskContext,
  ]);

  const changeExpandedGroups = (values: string[]) => {
    setExpandedGroupIds((currentIds) => {
      const nextIds = new Set(currentIds);
      selectedCategory?.groups.forEach((group) => {
        if (values.includes(group.id)) nextIds.add(group.id);
        else nextIds.delete(group.id);
      });

      return nextIds;
    });

    if (
      revealCustomGroupId &&
      revealCustomCategory &&
      expandedGroupValues.includes(revealCustomGroupId) &&
      !values.includes(revealCustomGroupId)
    ) {
      setCollapsedRevealRequestId(revealCustomCategory.requestId);
    }
  };

  const selectCategory = (categoryId: string) => {
    if (categoryId === selectedCategory?.id) {
      return;
    }

    skipTaskFocusRestoration();
    setSelectedCategoryId(categoryId);
    setDismissedRevealRequestId(revealCustomCategory?.requestId ?? null);
    onCloseTaskDetail();
  };

  const selectTask = (taskId: string, event: MouseEvent<HTMLButtonElement>) => {
    rememberTaskSelection(event.currentTarget);
    onSelectTask(taskId);
  };

  const openTaskCreation = (event: MouseEvent<HTMLButtonElement>) => {
    taskCreationTriggerRef.current = event.currentTarget;
    event.currentTarget.focus({ preventScroll: true });
    onOpenTaskCreation?.();
  };

  const isForegroundBlocked =
    loginRequiredReason !== null ||
    confirmationViewModel.statusChange !== null ||
    confirmationViewModel.deletions.length > 0 ||
    !!taskCreation?.isDiscardDialogOpen ||
    !!appointmentCreation?.isDiscardDialogOpen ||
    !!appointmentManagement?.editing.isDiscardDialogOpen;
  const isSubmitting =
    taskCreation?.submissionState.status === "submitting" ||
    appointmentCreation?.submissionState.status === "submitting" ||
    appointmentManagement?.editing.submissionState.status === "submitting";
  const closeForeground = () => {
    if (isForegroundBlocked || isSubmitting) return;
    if (isTaskCreationOpen) taskCreation?.requestClose();
    else if (isAppointmentCreationOpen) appointmentCreation?.cancel();
    else if (isAppointmentEditingOpen) appointmentManagement?.editing.cancel();
    else onCloseTaskDetail();
  };
  const isMobileForegroundOpen =
    (isMobileLayout || isOverlay) && foregroundPresent;
  const backgroundHidden = isMobileForegroundOpen || isForegroundBlocked;
  const navigation = (
    <div
      aria-hidden={backgroundHidden || undefined}
      inert={backgroundHidden || undefined}
    >
      <ChecklistCategories
        categories={categories}
        selectedCategoryId={selectedCategory?.id}
        controlsId="checklist-category-content"
        placement={layout.navigationPlacement}
        onSelect={selectCategory}
      />
    </div>
  );
  const confirmations = (
    <ChecklistConfirmations
      confirmations={confirmationViewModel}
      loginRequiredReason={loginRequiredReason}
      onCancelLoginRequired={onCancelLoginRequired}
      onVisitLogin={onVisitLogin}
      taskCreationTriggerRef={taskCreationTriggerRef}
      fallbackFocusRef={addTaskButtonRef}
    />
  );
  const foreground = foregroundPresent ? (
    <ChecklistForeground
      open={hasAside}
      onExited={completeForegroundExit}
      modal={
        isOverlay ||
        (isMobileLayout &&
          (isTaskCreationOpen ||
            isAppointmentCreationOpen ||
            isAppointmentEditingOpen))
      }
      overlay={isOverlay}
      blocked={isForegroundBlocked}
      pending={isSubmitting}
      titleId={
        isTaskCreationOpen
          ? "checklist-task-creation-title"
          : isAppointmentCreationOpen || isAppointmentEditingOpen
            ? "checklist-appointment-creation-title"
            : `${selectedTaskContext?.task.id}-detail-title`
      }
      onClose={closeForeground}
    >
      {selectedTaskContext &&
      !isMobileLayout &&
      !isTaskCreationOpen &&
      !isAppointmentCreationOpen &&
      !isAppointmentEditingOpen ? (
        <ChecklistTaskDetailPanel
          modal={isOverlay}
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
          modal={isMobileLayout || isOverlay}
          categories={categories}
          controller={taskCreation}
          returnFocusRef={taskCreationTriggerRef}
          fallbackFocusRef={addTaskButtonRef}
        />
      ) : null}

      {selectedTaskContext &&
      appointmentCreation &&
      isAppointmentCreationOpen ? (
        <ChecklistAppointmentForm
          modal={isMobileLayout || isOverlay}
          controller={appointmentCreation}
          taskTitle={selectedTaskContext.task.title}
        />
      ) : null}

      {selectedTaskContext &&
      appointmentManagement &&
      isAppointmentEditingOpen ? (
        <ChecklistAppointmentForm
          modal={isMobileLayout || isOverlay}
          controller={appointmentManagement.editing}
          heading="일정 수정"
          taskTitle={selectedTaskContext.task.title}
        />
      ) : null}
      {confirmations}
    </ChecklistForeground>
  ) : undefined;

  return (
    <>
      <ChecklistHeader
        categoryTitle={selectedCategory?.title}
        taskCount={tasks.length}
        completedCount={completedTaskCount}
        isAuthenticated={isAuthenticated}
        hidden={backgroundHidden}
        onAddTask={openTaskCreation}
        addTaskButtonRef={addTaskButtonRef}
      />
      <WorkspaceLayout
        ref={workspaceRef}
        layout={layout}
        navigation={navigation}
        aside={foreground}
        className="checklist-workspace"
      >
        <div
          aria-hidden={backgroundHidden || undefined}
          className="checklist-workspace__main"
          inert={backgroundHidden || undefined}
        >
          <section
            aria-label={
              layout.navigationPlacement === "side"
                ? "결혼 준비 체크리스트"
                : undefined
            }
            aria-labelledby={
              layout.navigationPlacement === "top" && selectedCategory
                ? getChecklistCategoryTabId(selectedCategory.id)
                : undefined
            }
            role={layout.navigationPlacement === "top" ? "tabpanel" : undefined}
            tabIndex={layout.navigationPlacement === "top" ? 0 : undefined}
            className="checklist"
            id="checklist-category-content"
          >
            {selectedCategory && tasks.length === 0 ? (
              <Result
                title="아직 담은 할 일이 없어요"
                description="로드맵에서 추천 할 일을 고르거나 직접 추가해 보세요."
                button={
                  <>
                    <Result.Button
                      size="large"
                      color="primary"
                      variant="fill"
                      onClick={() => onVisitPreparation?.(selectedCategory.id)}
                      type="button"
                    >
                      로드맵에서 추가
                    </Result.Button>
                    <Result.Button
                      size="large"
                      color="dark"
                      variant="weak"
                      onClick={openTaskCreation}
                      type="button"
                    >
                      직접 추가
                    </Result.Button>
                  </>
                }
              />
            ) : (
              <ChecklistGroups
                groups={selectedCategory?.groups ?? []}
                value={expandedGroupValues}
                onValueChange={changeExpandedGroups}
                selectedTaskId={selectedTaskId}
                detailId={
                  isMobileLayout
                    ? "checklist-task-detail-bottom-sheet"
                    : "checklist-task-detail-panel"
                }
                firstGroupTriggerRef={fallbackFocusRef}
                onSelectTask={selectTask}
                onTaskButtonRef={registerTaskButton}
              />
            )}
          </section>
        </div>
      </WorkspaceLayout>

      {!foregroundPresent ? confirmations : null}
    </>
  );
}
