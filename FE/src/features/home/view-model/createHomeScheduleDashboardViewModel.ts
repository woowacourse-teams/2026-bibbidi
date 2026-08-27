import { HomeScheduleDashboardModel } from "../model/homeScheduleDashboard";

export interface HomeScheduleDashboardLoadingViewModel {
  loadingLabel: string;
  status: "loading";
}

export type HomeScheduleDashboardViewModel =
  HomeScheduleDashboardLoadingViewModel;

export function createHomeScheduleDashboardViewModel(
  model: HomeScheduleDashboardModel,
): HomeScheduleDashboardViewModel {
  return {
    loadingLabel: "일정 대시보드를 불러오는 중입니다.",
    status: model.status,
  };
}
