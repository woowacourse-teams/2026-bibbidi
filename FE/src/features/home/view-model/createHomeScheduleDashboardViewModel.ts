import type {
  HomeScheduleDashboardModel,
  HomeScheduleDashboardRecommendedModel,
  HomeScheduleDashboardUnscheduledModel,
  HomeScheduleDashboardUpcomingModel,
} from "../model/homeScheduleDashboard";
import type { RecommendedTaskAdditionState } from "../model/recommendedTaskAddition";
import {
  createRecommendedScheduleViewModel,
  RecommendedScheduleViewModel,
} from "./createRecommendedScheduleViewModel";
import {
  createUnscheduledTaskViewModel,
  UnscheduledTaskViewModel,
} from "./createUnscheduledTaskViewModel";
import {
  createUpcomingScheduleViewModel,
  UpcomingScheduleViewModel,
} from "./createUpcomingScheduleViewModel";

export type HomeScheduleDashboardResultIcon =
  "alert" | "calendar-check" | "calendar-days" | "calendar-heart";

export type HomeScheduleDashboardResultTone = "critical" | "neutral";

export interface HomeScheduleDashboardResultViewModel {
  actionLabel: string;
  actionTo?: string;
  actionVariant: "button" | "link";
  description: string;
  icon: HomeScheduleDashboardResultIcon;
  isActionDisabled: boolean;
  title: string;
  tone: HomeScheduleDashboardResultTone;
}

export interface HomeScheduleDashboardResultSectionViewModel<
  TStatus extends "empty" | "error" = "empty" | "error",
> {
  countLabel?: string;
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
  | HomeScheduleDashboardResultSectionViewModel<"empty" | "error">
  | {
      content: UpcomingScheduleViewModel;
      status: "complete";
    };

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

function createErrorResult(
  title: string,
  isActionDisabled = true,
): HomeScheduleDashboardResultViewModel {
  return {
    actionLabel: "다시 시도",
    actionVariant: "button",
    description: "잠시 후 다시 시도해주세요",
    icon: "alert",
    isActionDisabled,
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
        result: createErrorResult("일정을 불러오지 못했어요", false),
        status: model.status,
        title: "가까운 일정",
      };
    case "complete":
      return {
        content: createUpcomingScheduleViewModel(model.schedules),
        status: model.status,
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
        result: createErrorResult("할 일을 불러오지 못했어요", false),
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
  addition: RecommendedTaskAdditionState,
): HomeScheduleDashboardRecommendedViewModel {
  switch (model.status) {
    case "loading":
      return {
        loadingLabel: "추천 할 일을 불러오는 중입니다.",
        status: model.status,
      };
    case "empty":
      return {
        countLabel: "0개",
        result: {
          actionLabel: "준비 목록 보기",
          actionTo: "/",
          actionVariant: "link",
          description: "새로 추가할 준비 목록의 할 일이 없어요",
          icon: "calendar-heart",
          isActionDisabled: false,
          title: "추천할 일이 없어요",
          tone: "neutral",
        },
        status: model.status,
        title: "추천 할 일",
      };
    case "error":
      return {
        result: createErrorResult("추천 할 일을 불러오지 못했어요", false),
        status: model.status,
        title: "추천 할 일",
      };
    case "complete":
      return {
        content: createRecommendedScheduleViewModel(
          model.recommendedItems,
          addition,
        ),
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
  options: {
    recommendedTaskAddition?: RecommendedTaskAdditionState;
  } = {},
): HomeScheduleDashboardViewModel {
  const recommendedTaskAddition = options.recommendedTaskAddition ?? {
    addedCatalogItemIds: [],
    addingCatalogItemIds: [],
    additionErrors: {},
  };

  return {
    recommended: createRecommendedViewModel(
      model.recommended,
      recommendedTaskAddition,
    ),
    unscheduled: createUnscheduledViewModel(model.unscheduled),
    upcoming: createUpcomingViewModel(model.upcoming),
  };
}
