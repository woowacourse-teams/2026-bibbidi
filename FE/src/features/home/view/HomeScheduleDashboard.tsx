import {
  HomeScheduleDashboardLoadingSectionViewModel,
  HomeScheduleDashboardRecommendedViewModel,
  HomeScheduleDashboardResultIcon,
  HomeScheduleDashboardResultSectionViewModel,
  HomeScheduleDashboardResultViewModel,
  HomeScheduleDashboardUnscheduledViewModel,
  HomeScheduleDashboardUpcomingViewModel,
  HomeScheduleDashboardViewModel,
} from "../view-model/createHomeScheduleDashboardViewModel";
import "./HomeScheduleDashboard.css";
import { RecommendedSchedule } from "./RecommendedSchedule";
import { UnscheduledTask } from "./UnscheduledTask";

interface HomeScheduleDashboardProps {
  viewModel: HomeScheduleDashboardViewModel;
}

interface DashboardResultSectionProps {
  className?: string;
  id: string;
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
    case "calendar-days":
      return (
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
          <path d="M7 3v3M17 3v3M4 9h16" />
          <rect height="16" rx="2" width="16" x="4" y="5" />
          <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" />
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
    case "complete":
      return (
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.7 2.7L16.5 9" />
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
  viewModel,
}: {
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
      <button
        className={`home-dashboard-state__result-action home-dashboard-state__result-action--${viewModel.actionVariant}`}
        disabled={viewModel.isActionDisabled}
        type="button"
      >
        {viewModel.actionVariant === "button" && <RefreshIcon />}
        {viewModel.actionLabel}
        {viewModel.actionVariant === "link" && <ChevronRightIcon />}
      </button>
    </div>
  );
}

function DashboardResultSection({
  className = "",
  id,
  viewModel,
}: DashboardResultSectionProps) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={`home-dashboard-state__section home-dashboard-state__section--${viewModel.status} ${className}`.trim()}
    >
      <header className="home-dashboard-state__section-header">
        <h2 id={`${id}-title`}>{viewModel.title}</h2>
        {viewModel.countLabel !== null && (
          <span className="home-dashboard-state__count">
            {viewModel.countLabel}
          </span>
        )}
      </header>
      <DashboardResult viewModel={viewModel.result} />
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

function UpcomingScheduleSkeleton() {
  return (
    <li className="home-dashboard-loading__upcoming-card">
      <div className="home-dashboard-loading__upcoming-meta">
        <span className="home-dashboard-loading__upcoming-date" />
        <span className="home-dashboard-loading__upcoming-badge" />
      </div>
      <span className="home-dashboard-loading__upcoming-title" />
      <span aria-hidden="true" className="home-dashboard-loading__spacer" />
      <span className="home-dashboard-loading__upcoming-detail" />
    </li>
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
        <span className="home-dashboard-loading__recommended-timing" />
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

function UpcomingScheduleLoading({
  viewModel,
}: {
  viewModel: HomeScheduleDashboardLoadingSectionViewModel;
}) {
  return (
    <section aria-busy="true" className="home-dashboard-loading__section">
      <LoadingStatus viewModel={viewModel} />
      <div aria-hidden="true">
        <SkeletonSectionHeader />
        <ul className="home-dashboard-loading__upcoming-list">
          {Array.from({ length: 6 }, (_, index) => (
            <UpcomingScheduleSkeleton key={index} />
          ))}
        </ul>
      </div>
    </section>
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

function UpcomingScheduleSection({
  viewModel,
}: {
  viewModel: HomeScheduleDashboardUpcomingViewModel;
}) {
  switch (viewModel.status) {
    case "loading":
      return <UpcomingScheduleLoading viewModel={viewModel} />;
    case "empty":
    case "error":
    case "complete":
      return (
        <DashboardResultSection
          id="dashboard-upcoming-schedule"
          viewModel={viewModel}
        />
      );
    default:
      return assertNever(viewModel);
  }
}

function UnscheduledTaskSection({
  viewModel,
}: {
  viewModel: HomeScheduleDashboardUnscheduledViewModel;
}) {
  switch (viewModel.status) {
    case "loading":
      return <UnscheduledTaskLoading viewModel={viewModel} />;
    case "empty":
    case "error":
      return (
        <DashboardResultSection
          id="dashboard-unscheduled-task"
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
  viewModel,
}: {
  viewModel: HomeScheduleDashboardRecommendedViewModel;
}) {
  switch (viewModel.status) {
    case "loading":
      return <RecommendedScheduleLoading viewModel={viewModel} />;
    case "empty":
    case "error":
      return (
        <DashboardResultSection
          className="home-dashboard-state__section--recommended"
          id="dashboard-recommended-schedule"
          viewModel={viewModel}
        />
      );
    case "complete":
      return <RecommendedSchedule viewModel={viewModel.content} />;
    default:
      return assertNever(viewModel);
  }
}

export function HomeScheduleDashboard({
  viewModel,
}: HomeScheduleDashboardProps) {
  return (
    <section aria-label="홈 일정 대시보드" className="home-dashboard-state">
      <div className="home-dashboard-state__top">
        <UpcomingScheduleSection viewModel={viewModel.upcoming} />
        <UnscheduledTaskSection viewModel={viewModel.unscheduled} />
      </div>
      <RecommendedScheduleSection viewModel={viewModel.recommended} />
    </section>
  );
}
