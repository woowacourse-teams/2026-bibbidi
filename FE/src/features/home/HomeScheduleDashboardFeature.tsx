import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../auth";
import { usePreparationChecklistRepository } from "../preparation";
import {
  nearbyAppointmentsRepository,
  recommendedCatalogItemsRepository,
  unscheduledTasksRepository,
} from "./homeDependencies";
import {
  HomeScheduleDashboardModel,
  HomeScheduleDashboardRecommendedModel,
  HomeScheduleDashboardUnscheduledModel,
  HomeScheduleDashboardUpcomingModel,
} from "./model/homeScheduleDashboard";
import { NearbyAppointmentsRepository } from "./repository/nearbyAppointmentsRepository";
import {
  NearbyAppointmentsAuthenticationRequiredError,
  NearbyAppointmentsRequestAbortedError,
} from "./repository/nearbyAppointmentsRepository";
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
import { HomeScheduleDashboard } from "./view/HomeScheduleDashboard";
import { useRecommendedTaskAddition } from "./useRecommendedTaskAddition";

const initialModel: HomeScheduleDashboardModel = {
  recommended: {
    status: "loading",
  },
  unscheduled: {
    status: "loading",
  },
  upcoming: {
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
  nearbyRepository?: NearbyAppointmentsRepository;
  recommendedRepository?: RecommendedCatalogItemsRepository;
  unscheduledRepository?: UnscheduledTasksRepository;
}

export function HomeScheduleDashboardFeature({
  getReferenceDate = getLocalDate,
  nearbyRepository = nearbyAppointmentsRepository,
  recommendedRepository = recommendedCatalogItemsRepository,
  unscheduledRepository = unscheduledTasksRepository,
}: HomeScheduleDashboardFeatureProps) {
  const { authState, refreshAuth } = useAuth();
  const authScope =
    authState.status === "authenticated"
      ? `authenticated:${authState.user.nickname}`
      : authState.status;
  const checklistRepository = usePreparationChecklistRepository();
  const [unscheduled, setUnscheduled] =
    useState<HomeScheduleDashboardUnscheduledModel>(initialModel.unscheduled);
  const [recommended, setRecommended] =
    useState<HomeScheduleDashboardRecommendedModel>(initialModel.recommended);
  const [upcoming, setUpcoming] = useState<HomeScheduleDashboardUpcomingModel>(
    initialModel.upcoming,
  );
  const [unscheduledRequestRevision, setUnscheduledRequestRevision] =
    useState(0);
  const [recommendedRequestRevision, setRecommendedRequestRevision] =
    useState(0);
  const [upcomingRequestRevision, setUpcomingRequestRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    nearbyRepository.getNearbyAppointments(controller.signal).then(
      (schedules) => {
        if (!isActive) {
          return;
        }

        setUpcoming(
          schedules.length === 0
            ? { status: "empty" }
            : {
                schedules: {
                  referenceDate: getReferenceDate(),
                  schedules,
                },
                status: "complete",
              },
        );
      },
      (error: unknown) => {
        if (
          !isActive ||
          error instanceof NearbyAppointmentsRequestAbortedError
        ) {
          return;
        }

        if (error instanceof NearbyAppointmentsAuthenticationRequiredError) {
          refreshAuth();
          return;
        }

        setUpcoming({ status: "error" });
      },
    );

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [
    authScope,
    getReferenceDate,
    nearbyRepository,
    refreshAuth,
    upcomingRequestRevision,
  ]);

  useEffect(() => {
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
    authScope,
    refreshAuth,
    unscheduledRepository,
    unscheduledRequestRevision,
  ]);

  useEffect(() => {
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
    authScope,
    recommendedRepository,
    recommendedRequestRevision,
    refreshAuth,
  ]);

  const retryUpcoming = useCallback(() => {
    setUpcoming({ status: "loading" });
    setUpcomingRequestRevision((revision) => revision + 1);
  }, []);

  const retryUnscheduled = useCallback(() => {
    setUnscheduled({ status: "loading" });
    setUnscheduledRequestRevision((revision) => revision + 1);
  }, []);

  const retryRecommended = useCallback(() => {
    setRecommended({ status: "loading" });
    setRecommendedRequestRevision((revision) => revision + 1);
  }, []);

  const recommendedTaskAddition = useRecommendedTaskAddition({
    authScope,
    isAuthenticated: authState.status === "authenticated",
    onAuthenticationRequired: refreshAuth,
    onSuccess: retryRecommended,
    repository: checklistRepository,
  });

  const viewModel = createHomeScheduleDashboardViewModel(
    {
      ...initialModel,
      recommended,
      unscheduled,
      upcoming,
    },
    { recommendedTaskAddition },
  );

  return (
    <HomeScheduleDashboard
      onAddRecommendedTask={recommendedTaskAddition.add}
      onRetryRecommended={retryRecommended}
      onRetryUnscheduled={retryUnscheduled}
      onRetryUpcoming={retryUpcoming}
      viewModel={viewModel}
    />
  );
}
