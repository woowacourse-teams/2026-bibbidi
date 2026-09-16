import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../auth";
import { nearbyAppointmentsRepository } from "./homeDependencies";
import {
  HomeScheduleDashboardModel,
  HomeScheduleDashboardUpcomingModel,
} from "./model/homeScheduleDashboard";
import { recommendedScheduleListMock } from "./model/recommendedSchedule.mock";
import { NearbyAppointmentsRepository } from "./repository/nearbyAppointmentsRepository";
import {
  NearbyAppointmentsAuthenticationRequiredError,
  NearbyAppointmentsRequestAbortedError,
} from "./repository/nearbyAppointmentsRepository";
import { createHomeScheduleDashboardViewModel } from "./view-model/createHomeScheduleDashboardViewModel";
import { HomeScheduleDashboard } from "./view/HomeScheduleDashboard";

const initialModel: HomeScheduleDashboardModel = {
  recommended: {
    schedules: recommendedScheduleListMock,
    status: "complete",
  },
  unscheduled: {
    status: "empty",
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
  repository?: NearbyAppointmentsRepository;
}

export function HomeScheduleDashboardFeature({
  getReferenceDate = getLocalDate,
  repository = nearbyAppointmentsRepository,
}: HomeScheduleDashboardFeatureProps) {
  const { refreshAuth } = useAuth();
  const [upcoming, setUpcoming] = useState<HomeScheduleDashboardUpcomingModel>(
    initialModel.upcoming,
  );
  const [requestRevision, setRequestRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    repository.getNearbyAppointments(controller.signal).then(
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
  }, [getReferenceDate, refreshAuth, repository, requestRevision]);

  const retryUpcoming = useCallback(() => {
    setUpcoming({ status: "loading" });
    setRequestRevision((revision) => revision + 1);
  }, []);

  const viewModel = createHomeScheduleDashboardViewModel({
    ...initialModel,
    upcoming,
  });

  return (
    <HomeScheduleDashboard
      onRetryUpcoming={retryUpcoming}
      viewModel={viewModel}
    />
  );
}
