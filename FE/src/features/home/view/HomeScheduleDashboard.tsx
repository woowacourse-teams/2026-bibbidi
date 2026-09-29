import { Link } from "react-router";

import {
  HomeScheduleDashboardLoadingSectionViewModel,
  HomeScheduleDashboardRecommendedViewModel,
  HomeScheduleDashboardResultIcon,
  HomeScheduleDashboardResultSectionViewModel,
  HomeScheduleDashboardResultViewModel,
  HomeScheduleDashboardUnscheduledViewModel,
  HomeScheduleDashboardViewModel,
} from "../view-model/createHomeScheduleDashboardViewModel";
import { CalendarScheduleModel } from "../model/homeScheduleDashboard";
import "./HomeScheduleDashboard.css";
import { RecommendedSchedule } from "./RecommendedSchedule";
import { MonthlyCalendar } from "./MonthlyCalendar";
import { UnscheduledTask } from "./UnscheduledTask";

interface HomeScheduleDashboardProps {
  onAddRecommendedTask: (catalogItemId: number) => void;
  onRetryRecommended: () => void;
  onRetryUnscheduled: () => void;
  referenceDate: string;
  schedules: CalendarScheduleModel[];
  viewModel: HomeScheduleDashboardViewModel;
}

interface DashboardResultSectionProps {
  className?: string;
  id: string;
  onAction?: () => void;
  viewModel: HomeScheduleDashboardResultSectionViewModel;
}

function assertNever(value: never): never {
  throw new Error(`처리하지 않은 홈 일정 대시보드 상태: ${String(value)}`);
}

function ResultIcon({ icon }: { icon: HomeScheduleDashboardResultIcon }) {
  switch (icon) {
    case "alert":
      return (
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
          <path d="M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      );
    case "calendar-check":
      return (
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
          <path d="M7 3v3M17 3v3M4 9h16" />
          <rect height="16" rx="2" width="16" x="4" y="5" />
          <path d="m9 15 2 2 4-4" />
        </svg>
      );
    case "calendar-heart":
      return (
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
          <path d="M7 3v3M17 3v3M4 9h16" />
          <rect height="16" rx="2" width="16" x="4" y="5" />
          <path d="M12 18s-3-1.7-3-4a1.8 1.8 0 0 1 3-1.3 1.8 1.8 0 0 1 3 1.3c0 2.3-3 4-3 4Z" />
        </svg>
      );
    case "lock":
      return (
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
          <rect height="10" rx="2" width="14" x="5" y="11" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3M12 15v2" />
        </svg>
      );
    default:
      return assertNever(icon);
  }
}

function ChevronRightIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M20 6v5h-5M4 18v-5h5" />
      <path d="M18.5 9A7 7 0 0 0 6 6.5L4 9M5.5 15A7 7 0 0 0 18 17.5l2-2.5" />
    </svg>
  );
}

function DashboardResult({
  onAction,
  viewModel,
}: {
  onAction?: () => void;
  viewModel: HomeScheduleDashboardResultViewModel;
}) {
  return (
    <div
      className={`home-dashboard-state__result home-dashboard-state__result--${viewModel.tone}`}
      role={viewModel.tone === "critical" ? "alert" : undefined}
    >
      <span className="home-dashboard-state__result-asset">
        <ResultIcon icon={viewModel.icon} />
      </span>
      <h3>{viewModel.title}</h3>
      <p>{viewModel.description}</p>
      {viewModel.actionLabel && viewModel.actionVariant ? (
        viewModel.actionTo ? (
          <Link
            className={`home-dashboard-state__result-action home-dashboard-state__result-action--${viewModel.actionVariant}`}
            to={viewModel.actionTo}
          >
            {viewModel.actionLabel}
            <ChevronRightIcon />
          </Link>
        ) : (
          <button
            className={`home-dashboard-state__result-action home-dashboard-state__result-action--${viewModel.actionVariant}`}
            disabled={viewModel.isActionDisabled}
            onClick={onAction}
            type="button"
          >
            {viewModel.actionVariant === "button" && <RefreshIcon />}
            {viewModel.actionLabel}
            {viewModel.actionVariant === "link" && <ChevronRightIcon />}
          </button>
        )
      ) : null}
    </div>
  );
}

function DashboardResultSection({
  className = "",
  id,
  onAction,
  viewModel,
}: DashboardResultSectionProps) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={`home-dashboard-state__section home-dashboard-state__section--${viewModel.status} ${className}`.trim()}
    >
      <header className="home-dashboard-state__section-header">
        <h2 id={`${id}-title`}>{viewModel.title}</h2>
        {viewModel.countLabel !== undefined && (
          <span className="home-dashboard-state__count">
            {viewModel.countLabel}
          </span>
        )}
      </header>
      <DashboardResult onAction={onAction} viewModel={viewModel.result} />
    </section>
  );
}

function SkeletonSectionHeader() {
  return (
    <div className="home-dashboard-loading__section-header">
      <span className="home-dashboard-loading__section-title" />
      <span className="home-dashboard-loading__section-action" />
    </div>
  );
}

function UnscheduledTaskSkeleton() {
  return (
    <li className="home-dashboard-loading__unscheduled-card">
      <span className="home-dashboard-loading__unscheduled-category" />
      <span className="home-dashboard-loading__unscheduled-title" />
      <span className="home-dashboard-loading__unscheduled-action" />
    </li>
  );
}

function RecommendedScheduleSkeleton() {
  return (
    <li className="home-dashboard-loading__recommended-card">
      <div className="home-dashboard-loading__recommended-meta">
        <span className="home-dashboard-loading__recommended-category" />
      </div>
      <span className="home-dashboard-loading__recommended-title" />
      <span className="home-dashboard-loading__recommended-description" />
      <span aria-hidden="true" className="home-dashboard-loading__spacer" />
      <span className="home-dashboard-loading__recommended-action" />
    </li>
  );
}

function LoadingStatus({
  viewModel,
}: {
  viewModel: HomeScheduleDashboardLoadingSectionViewModel;
}) {
  return (
    <p className="home-dashboard-loading__sr-only" role="status">
      {viewModel.loadingLabel}
    </p>
  );
}

function UnscheduledTaskLoading({
  viewModel,
}: {
  viewModel: HomeScheduleDashboardLoadingSectionViewModel;
}) {
  return (
    <section aria-busy="true" className="home-dashboard-loading__section">
      <LoadingStatus viewModel={viewModel} />
      <div aria-hidden="true">
        <SkeletonSectionHeader />
        <ul className="home-dashboard-loading__unscheduled-list">
          {Array.from({ length: 3 }, (_, index) => (
            <UnscheduledTaskSkeleton key={index} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function RecommendedScheduleLoading({
  viewModel,
}: {
  viewModel: HomeScheduleDashboardLoadingSectionViewModel;
}) {
  return (
    <section
      aria-busy="true"
      className="home-dashboard-loading__section home-dashboard-loading__recommended"
    >
      <LoadingStatus viewModel={viewModel} />
      <div aria-hidden="true">
        <SkeletonSectionHeader />
        <ul className="home-dashboard-loading__recommended-list">
          {Array.from({ length: 4 }, (_, index) => (
            <RecommendedScheduleSkeleton key={index} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function UnscheduledTaskSection({
  onRetry,
  viewModel,
}: {
  onRetry: () => void;
  viewModel: HomeScheduleDashboardUnscheduledViewModel;
}) {
  switch (viewModel.status) {
    case "loading":
      return <UnscheduledTaskLoading viewModel={viewModel} />;
    case "empty":
      return (
        <DashboardResultSection
          id="dashboard-unscheduled-task"
          viewModel={viewModel}
        />
      );
    case "error":
      return (
        <DashboardResultSection
          id="dashboard-unscheduled-task"
          onAction={onRetry}
          viewModel={viewModel}
        />
      );
    case "complete":
      return <UnscheduledTask viewModel={viewModel.content} />;
    default:
      return assertNever(viewModel);
  }
}

function RecommendedScheduleSection({
  onAddTask,
  onRetry,
  viewModel,
}: {
  onAddTask: (catalogItemId: number) => void;
  onRetry: () => void;
  viewModel: HomeScheduleDashboardRecommendedViewModel;
}) {
  switch (viewModel.status) {
    case "loading":
      return <RecommendedScheduleLoading viewModel={viewModel} />;
    case "empty":
      return (
        <DashboardResultSection
          className="home-dashboard-state__section--recommended"
          id="dashboard-recommended-schedule"
          viewModel={viewModel}
        />
      );
    case "error":
      return (
        <DashboardResultSection
          className="home-dashboard-state__section--recommended"
          id="dashboard-recommended-schedule"
          onAction={onRetry}
          viewModel={viewModel}
        />
      );
    case "complete":
      return (
        <RecommendedSchedule
          onAddTask={onAddTask}
          viewModel={viewModel.content}
        />
      );
    default:
      return assertNever(viewModel);
  }
}

const guestUnscheduledViewModel: HomeScheduleDashboardResultSectionViewModel<"authentication-required"> =
  {
    result: {
      description: "로드맵에서 필요한 할 일을 체크리스트에 추가할 수 있어요.",
      icon: "lock",
      title: "로그인하면 일정이 필요한 할 일을 확인할 수 있어요.",
      tone: "neutral",
    },
    status: "authentication-required",
    title: "일정이 필요한 할 일",
  };

const guestRecommendedViewModel: HomeScheduleDashboardResultSectionViewModel<"authentication-required"> =
  {
    result: {
      description: "로드맵에서 필요한 할 일을 체크리스트에 추가할 수 있어요.",
      icon: "lock",
      title: "로그인하면 나에게 맞는 추천 할 일을 확인할 수 있어요.",
      tone: "neutral",
    },
    status: "authentication-required",
    title: "추천 할 일",
  };

export function GuestHomeScheduleDashboard({
  referenceDate,
}: {
  referenceDate: string;
}) {
  return (
    <section aria-label="홈 일정 대시보드" className="home-dashboard-state">
      <div className="home-dashboard-state__top">
        <MonthlyCalendar referenceDate={referenceDate} />
        <div className="home-dashboard-state__side">
          <DashboardResultSection
            id="dashboard-unscheduled-task"
            viewModel={guestUnscheduledViewModel}
          />
          <DashboardResultSection
            className="home-dashboard-state__section--recommended"
            id="dashboard-recommended-schedule"
            viewModel={guestRecommendedViewModel}
          />
        </div>
      </div>
    </section>
  );
}

export function HomeScheduleDashboard({
  onAddRecommendedTask,
  onRetryRecommended,
  onRetryUnscheduled,
  referenceDate,
  schedules,
  viewModel,
}: HomeScheduleDashboardProps) {
  return (
    <section aria-label="홈 일정 대시보드" className="home-dashboard-state">
      <div className="home-dashboard-state__top">
        <MonthlyCalendar referenceDate={referenceDate} schedules={schedules} />
        <div className="home-dashboard-state__side">
          <UnscheduledTaskSection
            onRetry={onRetryUnscheduled}
            viewModel={viewModel.unscheduled}
          />
          <RecommendedScheduleSection
            onAddTask={onAddRecommendedTask}
            onRetry={onRetryRecommended}
            viewModel={viewModel.recommended}
          />
        </div>
      </div>
    </section>
  );
}
