import { HomeScheduleDashboardModel } from "./model/homeScheduleDashboard";
import { createHomeScheduleDashboardViewModel } from "./view-model/createHomeScheduleDashboardViewModel";
import { HomeScheduleDashboard } from "./view/HomeScheduleDashboard";

const model: HomeScheduleDashboardModel = {
  status: "loading",
};

const viewModel = createHomeScheduleDashboardViewModel(model);

export function HomeScheduleDashboardFeature() {
  return <HomeScheduleDashboard viewModel={viewModel} />;
}
