import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../auth";
import {
  nearbyAppointmentsRepository,
  unscheduledTasksRepository,
} from "./homeDependencies";
import {
  HomeScheduleDashboardModel,
  HomeScheduleDashboardUnscheduledModel,
  HomeScheduleDashboardUpcomingModel,
} from "./model/homeScheduleDashboard";
import { recommendedScheduleListMock } from "./model/recommendedSchedule.mock";
import { NearbyAppointmentsRepository } from "./repository/nearbyAppointmentsRepository";
import {
  NearbyAppointmentsAuthenticationRequiredError,
  NearbyAppointmentsRequestAbortedError,
} from "./repository/nearbyAppointmentsRepository";
import {
  UnscheduledTasksAuthenticationRequiredError,
  UnscheduledTasksRepository,
  UnscheduledTasksRequestAbortedError,
} from "./repository/unscheduledTasksRepository";
import { createHomeScheduleDashboardViewModel } from "./view-model/createHomeScheduleDashboardViewModel";
import { HomeScheduleDashboard } from "./view/HomeScheduleDashboard";

const initialModel: HomeScheduleDashboardModel = {
  recommended: {
    schedules: recommendedScheduleListMock,
    status: "complete",
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
  unscheduledRepository?: UnscheduledTasksRepository;
}

export function HomeScheduleDashboardFeature({
  getReferenceDate = getLocalDate,
  nearbyRepository = nearbyAppointmentsRepository,
  unscheduledRepository = unscheduledTasksRepository,
}: HomeScheduleDashboardFeatureProps) {
  const { refreshAuth } = useAuth();
  const [unscheduled, setUnscheduled] =
    useState<HomeScheduleDashboardUnscheduledModel>(initialModel.unscheduled);
  const [upcoming, setUpcoming] = useState<HomeScheduleDashboardUpcomingModel>(
    initialModel.upcoming,
  );
  const [unscheduledRequestRevision, setUnscheduledRequestRevision] =
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
  }, [refreshAuth, unscheduledRepository, unscheduledRequestRevision]);

  const retryUpcoming = useCallback(() => {
    setUpcoming({ status: "loading" });
    setUpcomingRequestRevision((revision) => revision + 1);
  }, []);

  const retryUnscheduled = useCallback(() => {
    setUnscheduled({ status: "loading" });
    setUnscheduledRequestRevision((revision) => revision + 1);
  }, []);

  const viewModel = createHomeScheduleDashboardViewModel({
    ...initialModel,
    unscheduled,
    upcoming,
  });

  return (
    <HomeScheduleDashboard
      onRetryUnscheduled={retryUnscheduled}
      onRetryUpcoming={retryUpcoming}
      viewModel={viewModel}
    />
  );
}
