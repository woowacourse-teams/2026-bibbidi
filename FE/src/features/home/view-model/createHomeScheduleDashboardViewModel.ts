import {
  HomeScheduleDashboardModel,
  HomeScheduleDashboardRecommendedModel,
  HomeScheduleDashboardUnscheduledModel,
  HomeScheduleDashboardUpcomingModel,
} from "../model/homeScheduleDashboard";
import {
  createRecommendedScheduleViewModel,
  RecommendedScheduleViewModel,
} from "./createRecommendedScheduleViewModel";
import {
  createUnscheduledTaskViewModel,
  UnscheduledTaskViewModel,
} from "./createUnscheduledTaskViewModel";

export type HomeScheduleDashboardResultIcon =
  "alert" | "calendar-check" | "calendar-days" | "calendar-heart" | "complete";

export type HomeScheduleDashboardResultTone =
  "critical" | "neutral" | "positive";

export interface HomeScheduleDashboardResultViewModel {
  actionLabel: string;
  actionVariant: "button" | "link";
  description: string;
  icon: HomeScheduleDashboardResultIcon;
  isActionDisabled: boolean;
  title: string;
  tone: HomeScheduleDashboardResultTone;
}

export interface HomeScheduleDashboardResultSectionViewModel<
  TStatus extends "complete" | "empty" | "error" =
    "complete" | "empty" | "error",
> {
  countLabel: string | null;
  result: HomeScheduleDashboardResultViewModel;
  status: TStatus;
  title: string;
}

export interface HomeScheduleDashboardLoadingSectionViewModel {
  loadingLabel: string;
  status: "loading";
}

export type HomeScheduleDashboardUpcomingViewModel =
  | HomeScheduleDashboardLoadingSectionViewModel
  | HomeScheduleDashboardResultSectionViewModel;

export interface HomeScheduleDashboardUnscheduledCompleteViewModel {
  content: UnscheduledTaskViewModel;
  status: "complete";
}

export type HomeScheduleDashboardUnscheduledViewModel =
  | HomeScheduleDashboardLoadingSectionViewModel
  | HomeScheduleDashboardResultSectionViewModel<"empty" | "error">
  | HomeScheduleDashboardUnscheduledCompleteViewModel;

export interface HomeScheduleDashboardRecommendedCompleteViewModel {
  content: RecommendedScheduleViewModel;
  status: "complete";
}

export type HomeScheduleDashboardRecommendedViewModel =
  | HomeScheduleDashboardLoadingSectionViewModel
  | HomeScheduleDashboardResultSectionViewModel<"empty" | "error">
  | HomeScheduleDashboardRecommendedCompleteViewModel;

export interface HomeScheduleDashboardViewModel {
  recommended: HomeScheduleDashboardRecommendedViewModel;
  unscheduled: HomeScheduleDashboardUnscheduledViewModel;
  upcoming: HomeScheduleDashboardUpcomingViewModel;
}

function formatCount(count: number) {
  return `${count}개`;
}

function createErrorResult(
  title: string,
): HomeScheduleDashboardResultViewModel {
  return {
    actionLabel: "다시 시도",
    actionVariant: "button",
    description: "잠시 후 다시 시도해주세요",
    icon: "alert",
    isActionDisabled: true,
    title,
    tone: "critical",
  };
}

function createUpcomingViewModel(
  model: HomeScheduleDashboardUpcomingModel,
): HomeScheduleDashboardUpcomingViewModel {
  switch (model.status) {
    case "loading":
      return {
        loadingLabel: "가까운 일정을 불러오는 중입니다.",
        status: model.status,
      };
    case "empty":
      return {
        countLabel: formatCount(0),
        result: {
          actionLabel: "체크리스트 보기",
          actionVariant: "link",
          description: "일정이 있는 할 일은 여기에 표시돼요",
          icon: "calendar-days",
          isActionDisabled: true,
          title: "예정된 일정이 없어요",
          tone: "neutral",
        },
        status: model.status,
        title: "가까운 일정",
      };
    case "error":
      return {
        countLabel: null,
        result: createErrorResult("일정을 불러오지 못했어요"),
        status: model.status,
        title: "가까운 일정",
      };
    case "complete":
      return {
        countLabel: formatCount(model.count),
        result: {
          actionLabel: "완료한 일정 보기",
          actionVariant: "link",
          description: "완료한 일정은 체크리스트에서 다시 확인할 수 있어요",
          icon: "complete",
          isActionDisabled: true,
          title: "가까운 일정을 모두 완료했어요",
          tone: "positive",
        },
        status: model.status,
        title: "가까운 일정",
      };
    default:
      return assertNever(model);
  }
}

function createUnscheduledViewModel(
  model: HomeScheduleDashboardUnscheduledModel,
): HomeScheduleDashboardUnscheduledViewModel {
  switch (model.status) {
    case "loading":
      return {
        loadingLabel: "일정이 필요한 할 일을 불러오는 중입니다.",
        status: model.status,
      };
    case "empty":
      return {
        countLabel: formatCount(0),
        result: {
          actionLabel: "체크리스트 보기",
          actionVariant: "link",
          description: "진행 중인 할 일의 일정을 모두 정했어요",
          icon: "calendar-check",
          isActionDisabled: true,
          title: "일정이 필요한 할 일이 없어요",
          tone: "neutral",
        },
        status: model.status,
        title: "일정이 필요한 할 일",
      };
    case "error":
      return {
        countLabel: null,
        result: createErrorResult("할 일을 불러오지 못했어요"),
        status: model.status,
        title: "일정이 필요한 할 일",
      };
    case "complete":
      return {
        content: createUnscheduledTaskViewModel(model.tasks),
        status: model.status,
      };
    default:
      return assertNever(model);
  }
}

function createRecommendedViewModel(
  model: HomeScheduleDashboardRecommendedModel,
): HomeScheduleDashboardRecommendedViewModel {
  switch (model.status) {
    case "loading":
      return {
        loadingLabel: "추천 일정을 불러오는 중입니다.",
        status: model.status,
      };
    case "empty":
      return {
        countLabel: formatCount(0),
        result: {
          actionLabel: "준비 목록 보기",
          actionVariant: "link",
          description: "현재 준비 단계에 필요한 일정을 모두 추가했어요",
          icon: "calendar-heart",
          isActionDisabled: true,
          title: "추천할 일정이 없어요",
          tone: "neutral",
        },
        status: model.status,
        title: "추가하면 좋은 일정",
      };
    case "error":
      return {
        countLabel: null,
        result: createErrorResult("추천 일정을 불러오지 못했어요"),
        status: model.status,
        title: "추가하면 좋은 일정",
      };
    case "complete":
      return {
        content: createRecommendedScheduleViewModel(model.schedules),
        status: model.status,
      };
    default:
      return assertNever(model);
  }
}

function assertNever(value: never): never {
  throw new Error(`처리하지 않은 홈 일정 대시보드 상태: ${String(value)}`);
}

export function createHomeScheduleDashboardViewModel(
  model: HomeScheduleDashboardModel,
): HomeScheduleDashboardViewModel {
  return {
    recommended: createRecommendedViewModel(model.recommended),
    unscheduled: createUnscheduledViewModel(model.unscheduled),
    upcoming: createUpcomingViewModel(model.upcoming),
  };
}
