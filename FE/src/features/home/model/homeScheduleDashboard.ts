import { RecommendedCatalogItemListModel } from "./recommendedCatalogItem";
import { UnscheduledTaskListModel } from "./unscheduledTask";

export interface CalendarScheduleModel {
  date: string;
  id: number;
  title: string;
}

export interface HomeScheduleDashboardLoadingSectionModel {
  status: "loading";
}

export interface HomeScheduleDashboardEmptySectionModel {
  status: "empty";
}

export interface HomeScheduleDashboardErrorSectionModel {
  status: "error";
}

export interface HomeScheduleDashboardUnscheduledCompleteModel {
  status: "complete";
  tasks: UnscheduledTaskListModel;
}

export type HomeScheduleDashboardUnscheduledModel =
  | HomeScheduleDashboardLoadingSectionModel
  | HomeScheduleDashboardEmptySectionModel
  | HomeScheduleDashboardErrorSectionModel
  | HomeScheduleDashboardUnscheduledCompleteModel;

export interface HomeScheduleDashboardRecommendedCompleteModel {
  recommendedItems: RecommendedCatalogItemListModel;
  status: "complete";
}

export type HomeScheduleDashboardRecommendedModel =
  | HomeScheduleDashboardLoadingSectionModel
  | HomeScheduleDashboardEmptySectionModel
  | HomeScheduleDashboardErrorSectionModel
  | HomeScheduleDashboardRecommendedCompleteModel;

export interface HomeScheduleDashboardModel {
  recommended: HomeScheduleDashboardRecommendedModel;
  unscheduled: HomeScheduleDashboardUnscheduledModel;
}
