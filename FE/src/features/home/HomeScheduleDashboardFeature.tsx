import { useCallback, useEffect, useState } from "react";

import { analytics } from "../../infrastructure/analytics";
import { useAuth } from "../auth";
import {
  MyChecklistAuthenticationRequiredError,
  type MyChecklistQueryRepository,
  MyChecklistRequestAbortedError,
  useMyChecklistQueryRepository,
} from "../checklist";
import { usePreparationChecklistRepository } from "../preparation";
import { createPreparationItemAddEvent } from "../preparation/analytics/preparationAnalytics";
import {
  recommendedCatalogItemsRepository,
  unscheduledTasksRepository,
} from "./homeDependencies";
import {
  CalendarScheduleModel,
  HomeScheduleDashboardModel,
  HomeScheduleDashboardRecommendedModel,
  HomeScheduleDashboardUnscheduledModel,
} from "./model/homeScheduleDashboard";
import {
  RecommendedCatalogItemsAuthenticationRequiredError,
  RecommendedCatalogItemsRepository,
  RecommendedCatalogItemsRequestAbortedError,
} from "./repository/recommendedCatalogItemsRepository";
import {
  UnscheduledTasksAuthenticationRequiredError,
  UnscheduledTasksRepository,
  UnscheduledTasksRequestAbortedError,
} from "./repository/unscheduledTasksRepository";
import { createHomeScheduleDashboardViewModel } from "./view-model/createHomeScheduleDashboardViewModel";
import {
  GuestHomeScheduleDashboard,
  HomeScheduleDashboard,
} from "./view/HomeScheduleDashboard";
import { useRecommendedTaskAddition } from "./useRecommendedTaskAddition";

const initialModel: HomeScheduleDashboardModel = {
  recommended: {
    status: "loading",
  },
  unscheduled: {
    status: "loading",
  },
};

function getLocalDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

interface HomeScheduleDashboardFeatureProps {
  getReferenceDate?: () => string;
  recommendedRepository?: RecommendedCatalogItemsRepository;
  unscheduledRepository?: UnscheduledTasksRepository;
}

type AuthenticatedAuthState = Extract<
  ReturnType<typeof useAuth>["authState"],
  { status: "authenticated" }
>;

interface CalendarSchedulesState {
  authentication: AuthenticatedAuthState | null;
  repository: MyChecklistQueryRepository | null;
  schedules: CalendarScheduleModel[];
}

export function HomeScheduleDashboardFeature({
  getReferenceDate = getLocalDate,
  recommendedRepository = recommendedCatalogItemsRepository,
  unscheduledRepository = unscheduledTasksRepository,
}: HomeScheduleDashboardFeatureProps) {
  const { authState, refreshAuth } = useAuth();
  const authScope =
    authState.status === "authenticated"
      ? `authenticated:${authState.user.id}`
      : authState.status;
  const checklistRepository = usePreparationChecklistRepository();
  const myChecklistRepository = useMyChecklistQueryRepository();
  const authentication =
    authState.status === "authenticated" ? authState : null;
  const [calendarSchedules, setCalendarSchedules] =
    useState<CalendarSchedulesState>({
      authentication: null,
      repository: null,
      schedules: [],
    });
  const [unscheduled, setUnscheduled] =
    useState<HomeScheduleDashboardUnscheduledModel>(initialModel.unscheduled);
  const [recommended, setRecommended] =
    useState<HomeScheduleDashboardRecommendedModel>(initialModel.recommended);
  const [unscheduledRequestRevision, setUnscheduledRequestRevision] =
    useState(0);
  const [recommendedRequestRevision, setRecommendedRequestRevision] =
    useState(0);
  useEffect(() => {
    if (authState.status !== "authenticated") {
      return;
    }

    const controller = new AbortController();
    let isActive = true;

    myChecklistRepository.getChecklist(controller.signal).then(
      (checklist) => {
        if (!isActive) {
          return;
        }

        setCalendarSchedules({
          authentication,
          repository: myChecklistRepository,
          schedules: checklist.items.flatMap((item) =>
            item.appointments.map((appointment) => ({
              date: appointment.date,
              id: appointment.id,
              title: appointment.title,
            })),
          ),
        });
      },
      (error: unknown) => {
        if (!isActive || error instanceof MyChecklistRequestAbortedError) {
          return;
        }

        if (error instanceof MyChecklistAuthenticationRequiredError) {
          refreshAuth();
          return;
        }

        setCalendarSchedules({
          authentication,
          repository: myChecklistRepository,
          schedules: [],
        });
      },
    );

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [
    authState.status,
    authScope,
    authentication,
    myChecklistRepository,
    refreshAuth,
  ]);

  useEffect(() => {
    if (authState.status !== "authenticated") {
      return;
    }

    const controller = new AbortController();
    let isActive = true;

    unscheduledRepository.getUnscheduledTasks(controller.signal).then(
      (tasks) => {
        if (!isActive) {
          return;
        }

        setUnscheduled(
          tasks.length === 0
            ? { status: "empty" }
            : {
                status: "complete",
                tasks: { tasks },
              },
        );
      },
      (error: unknown) => {
        if (!isActive || error instanceof UnscheduledTasksRequestAbortedError) {
          return;
        }

        if (error instanceof UnscheduledTasksAuthenticationRequiredError) {
          refreshAuth();
          return;
        }

        setUnscheduled({ status: "error" });
      },
    );

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [
    authState.status,
    authScope,
    refreshAuth,
    unscheduledRepository,
    unscheduledRequestRevision,
  ]);

  useEffect(() => {
    if (authState.status !== "authenticated") {
      return;
    }

    const controller = new AbortController();
    let isActive = true;

    recommendedRepository.getRecommendedCatalogItems(controller.signal).then(
      (items) => {
        if (!isActive) {
          return;
        }

        setRecommended(
          items.length === 0
            ? { status: "empty" }
            : { recommendedItems: { items }, status: "complete" },
        );
      },
      (error: unknown) => {
        if (
          !isActive ||
          error instanceof RecommendedCatalogItemsRequestAbortedError
        ) {
          return;
        }

        if (
          error instanceof RecommendedCatalogItemsAuthenticationRequiredError
        ) {
          refreshAuth();
          return;
        }

        setRecommended({ status: "error" });
      },
    );

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [
    authState.status,
    authScope,
    recommendedRepository,
    recommendedRequestRevision,
    refreshAuth,
  ]);

  const retryUnscheduled = useCallback(() => {
    setUnscheduled({ status: "loading" });
    setUnscheduledRequestRevision((revision) => revision + 1);
  }, []);

  const retryRecommended = useCallback(() => {
    setRecommended({ status: "loading" });
    setRecommendedRequestRevision((revision) => revision + 1);
  }, []);

  const handleRecommendedTaskAdditionSuccess = useCallback(
    (catalogItemId: number, itemCount: number) => {
      const item =
        recommended.status === "complete"
          ? recommended.recommendedItems.items.find(
              (candidate) => candidate.catalogItemId === catalogItemId,
            )
          : undefined;

      if (item && itemCount > 0) {
        analytics.track(
          createPreparationItemAddEvent({
            categoryName: item.category,
            itemCount,
            phase: item.phase,
            source: "planner_recommendation",
          }),
        );
      }

      retryRecommended();
    },
    [recommended, retryRecommended],
  );

  const recommendedTaskAddition = useRecommendedTaskAddition({
    authScope,
    isAuthenticated: authState.status === "authenticated",
    onAuthenticationRequired: refreshAuth,
    onSuccess: handleRecommendedTaskAdditionSuccess,
    repository: checklistRepository,
  });

  const viewModel = createHomeScheduleDashboardViewModel(
    authState.status === "authenticated"
      ? {
          recommended,
          unscheduled,
        }
      : initialModel,
    { recommendedTaskAddition },
  );

  if (authState.status === "guest") {
    return <GuestHomeScheduleDashboard referenceDate={getReferenceDate()} />;
  }

  return (
    <HomeScheduleDashboard
      onAddRecommendedTask={recommendedTaskAddition.add}
      onRetryRecommended={retryRecommended}
      onRetryUnscheduled={retryUnscheduled}
      referenceDate={getReferenceDate()}
      schedules={
        authentication !== null &&
        calendarSchedules.authentication === authentication &&
        calendarSchedules.repository === myChecklistRepository
          ? calendarSchedules.schedules
          : []
      }
      viewModel={viewModel}
    />
  );
}
