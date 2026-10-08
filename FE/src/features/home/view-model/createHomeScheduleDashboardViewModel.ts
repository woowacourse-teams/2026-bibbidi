import type {
  HomeScheduleDashboardModel,
  HomeScheduleDashboardRecommendedModel,
  HomeScheduleDashboardUnscheduledModel,
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

export type HomeScheduleDashboardResultIcon =
  "alert" | "calendar-check" | "calendar-heart" | "lock";

export type HomeScheduleDashboardResultTone = "critical" | "neutral";

export interface HomeScheduleDashboardResultViewModel {
  actionLabel?: string;
  actionTo?: string;
  actionVariant?: "button" | "link";
  description: string;
  icon: HomeScheduleDashboardResultIcon;
  isActionDisabled?: boolean;
  title: string;
  tone: HomeScheduleDashboardResultTone;
}

export interface HomeScheduleDashboardResultSectionViewModel<
  TStatus extends "authentication-required" | "empty" | "error" =
    "authentication-required" | "empty" | "error",
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
          actionLabel: "로드맵에서 할 일 찾기",
          actionTo: "/preparation",
          actionVariant: "link",
          description: "진행 중인 할 일의 일정을 모두 정했어요",
          icon: "calendar-check",
          isActionDisabled: false,
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
          actionLabel: "로드맵 보기",
          actionTo: "/preparation",
          actionVariant: "link",
          description: "새로 추가할 로드맵의 할 일이 없어요",
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
  };
}
