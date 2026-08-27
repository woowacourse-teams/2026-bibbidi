import { HomeScheduleDashboardModel } from "./model/homeScheduleDashboard";
import { recommendedScheduleListMock } from "./model/recommendedSchedule.mock";
import { createHomeScheduleDashboardViewModel } from "./view-model/createHomeScheduleDashboardViewModel";
import { HomeScheduleDashboard } from "./view/HomeScheduleDashboard";

const model: HomeScheduleDashboardModel = {
  recommended: {
    schedules: recommendedScheduleListMock,
    status: "complete",
  },
  unscheduled: {
    status: "empty",
  },
  upcoming: {
    count: 3,
    status: "complete",
  },
};

const viewModel = createHomeScheduleDashboardViewModel(model);

export function HomeScheduleDashboardFeature() {
  return <HomeScheduleDashboard viewModel={viewModel} />;
}
