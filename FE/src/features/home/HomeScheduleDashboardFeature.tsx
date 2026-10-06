import { useCallback } from "react";

import { analytics } from "../../infrastructure/analytics";
import { useAuth } from "../auth";
import { usePreparationChecklistRepository } from "../preparation";
import { createPreparationItemAddEvent } from "../preparation/analytics/preparationAnalytics";
import { recommendedCatalogItemsRepository } from "./homeDependencies";
import type { RecommendedCatalogItemsRepository } from "./repository/recommendedCatalogItemsRepository";
import {
  createCalendarPlanningModel,
  getLocalDate,
} from "./model/calendarPlanning";
import { useRecommendedTaskAddition } from "./useRecommendedTaskAddition";
import { useCalendarPlanningData } from "./useCalendarPlanningData";
import { useCalendarDateAssignment } from "./useCalendarDateAssignment";
import { createRecommendedScheduleViewModel } from "./view-model/createRecommendedScheduleViewModel";
import { RecommendedSchedule } from "./view/RecommendedSchedule";
import { CalendarPlanning } from "./view/CalendarPlanning";
import { CalendarRecommendedState } from "./view/CalendarRecommendedState";
import { CalendarLoginDialog } from "./view/CalendarLoginDialog";
import { GuestRecommendedTasksFeature } from "./GuestRecommendedTasksFeature";
import { CalendarDateAssignment } from "./CalendarDateAssignment";

export function HomeScheduleDashboardFeature({
  getReferenceDate = getLocalDate,
  recommendedRepository = recommendedCatalogItemsRepository,
}: {
  getReferenceDate?: () => string;
  recommendedRepository?: RecommendedCatalogItemsRepository;
}) {
  const { authState, refreshAuth } = useAuth();
  const scope =
    authState.status === "authenticated"
      ? `authenticated:${authState.user.id}`
      : authState.status;
  // A new auth scope unmounts pending requests and clears personal data and drafts.
  return (
    <CalendarPlanningFeature
      key={scope}
      getReferenceDate={getReferenceDate}
      recommendedRepository={recommendedRepository}
      refreshAuth={refreshAuth}
    />
  );
}

function CalendarPlanningFeature({
  getReferenceDate,
  recommendedRepository,
  refreshAuth,
}: {
  getReferenceDate: () => string;
  recommendedRepository: RecommendedCatalogItemsRepository;
  refreshAuth: () => void;
}) {
  const { authState } = useAuth();
  const audience =
    authState.status === "authenticated"
      ? "authenticated"
      : authState.status === "guest"
        ? "guest"
        : undefined;
  const repository = usePreparationChecklistRepository();
  const {
    checklist,
    recommended,
    refreshChecklist,
    refreshRecommended,
    retryChecklist,
    retryRecommended,
  } = useCalendarPlanningData({
    audience,
    recommendedRepository,
    onAuthenticationRequired: refreshAuth,
  });
  const { tasks, undated, schedules, addedCatalogItemIds } =
    createCalendarPlanningModel(
      checklist.status === "complete" ? checklist.data : undefined,
    );
  const dateAssignment = useCalendarDateAssignment({
    audience,
    checklist,
    refreshChecklist,
  });
  const onSuccess = useCallback(
    (catalogItemId: number, itemCount: number) => {
      const item =
        recommended.status === "complete"
          ? recommended.data.find(
              (item) => item.catalogItemId === catalogItemId,
            )
          : undefined;
      if (item) {
        if (itemCount > 0)
          analytics.track(
            createPreparationItemAddEvent({
              categoryName: item.category,
              itemCount,
              phase: item.phase,
              source: "calendar_recommendation",
            }),
          );
      }
      refreshChecklist();
      refreshRecommended();
    },
    [recommended, refreshChecklist, refreshRecommended],
  );
  const addition = useRecommendedTaskAddition({
    authScope: audience ?? authState.status,
    isAuthenticated: audience === "authenticated",
    onAuthenticationRequired: refreshAuth,
    onSuccess,
    repository,
  });
  const remainingRecommendations =
    recommended.status === "complete"
      ? recommended.data.filter(
          (item) =>
            !addedCatalogItemIds.has(item.catalogItemId) &&
            !addition.addedCatalogItemIds.includes(item.catalogItemId),
        )
      : [];

  const recommendations =
    audience === "guest" ||
    (audience === "authenticated" &&
      checklist.status === "complete" &&
      tasks.length === 0) ? (
      <GuestRecommendedTasksFeature
        audience={audience}
        onAuthenticationRequired={refreshAuth}
        onAdded={refreshChecklist}
      />
    ) : recommended.status === "complete" &&
      checklist.status !== "loading" &&
      remainingRecommendations.length > 0 ? (
      <RecommendedSchedule
        compact
        onAddTask={addition.add}
        viewModel={createRecommendedScheduleViewModel(
          { items: remainingRecommendations },
          addition,
        )}
      />
    ) : (
      <CalendarRecommendedState
        status={recommended.status}
        isChecklistLoading={checklist.status === "loading"}
        onRetry={retryRecommended}
      />
    );

  return (
    <CalendarPlanning
      referenceDate={getReferenceDate()}
      schedules={schedules}
      focusDate={dateAssignment.focusDate}
      focusDateRevision={dateAssignment.focusDateRevision}
      checklistStatus={checklist.status}
      isGuest={audience === "guest"}
      hasTasks={tasks.length > 0}
      undated={undated.map(({ id, title, category }) => ({
        id,
        title,
        category,
      }))}
      retryChecklist={retryChecklist}
      onRequestDate={(id) => {
        const task = tasks.find((task) => task.id === id);
        if (task) dateAssignment.requestDate(task);
      }}
      recommendations={recommendations}
      dialogs={
        <>
          {dateAssignment.selectedTask &&
            dateAssignment.selectedTask.checklistItemId !== null && (
              <CalendarDateAssignment
                key={dateAssignment.selectedTask.checklistItemId}
                itemId={dateAssignment.selectedTask.checklistItemId}
                title={dateAssignment.selectedTask.title}
                onClose={dateAssignment.closeDate}
                onSaved={dateAssignment.onSaved}
              />
            )}
          {dateAssignment.loginTo && (
            <CalendarLoginDialog
              onClose={dateAssignment.closeLogin}
              loginTo={dateAssignment.loginTo}
            />
          )}
        </>
      }
    />
  );
}
