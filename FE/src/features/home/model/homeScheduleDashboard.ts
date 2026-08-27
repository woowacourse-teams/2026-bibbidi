import { RecommendedScheduleListModel } from "./recommendedSchedule";
import { UnscheduledTaskListModel } from "./unscheduledTask";

export interface HomeScheduleDashboardLoadingSectionModel {
  status: "loading";
}

export interface HomeScheduleDashboardEmptySectionModel {
  status: "empty";
}

export interface HomeScheduleDashboardErrorSectionModel {
  status: "error";
}

export interface HomeScheduleDashboardUpcomingCompleteModel {
  count: number;
  status: "complete";
}

export type HomeScheduleDashboardUpcomingModel =
  | HomeScheduleDashboardLoadingSectionModel
  | HomeScheduleDashboardEmptySectionModel
  | HomeScheduleDashboardErrorSectionModel
  | HomeScheduleDashboardUpcomingCompleteModel;

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
  schedules: RecommendedScheduleListModel;
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
  upcoming: HomeScheduleDashboardUpcomingModel;
}
