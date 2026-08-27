import { HomeScheduleDashboardViewModel } from "../view-model/createHomeScheduleDashboardViewModel";
import "./HomeScheduleDashboard.css";

interface HomeScheduleDashboardProps {
  viewModel: HomeScheduleDashboardViewModel;
}

interface HomeScheduleDashboardLoadingProps {
  loadingLabel: string;
}

function assertNever(value: never): never {
  throw new Error(`처리하지 않은 홈 일정 대시보드 상태: ${String(value)}`);
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

function HomeScheduleDashboardLoading({
  loadingLabel,
}: HomeScheduleDashboardLoadingProps) {
  return (
    <section
      aria-busy="true"
      aria-label="홈 일정 대시보드"
      className="home-dashboard-loading"
    >
      <p className="home-dashboard-loading__sr-only" role="status">
        {loadingLabel}
      </p>

      <div aria-hidden="true" className="home-dashboard-loading__top">
        <section className="home-dashboard-loading__section">
          <SkeletonSectionHeader />
          <ul className="home-dashboard-loading__upcoming-list">
            {Array.from({ length: 6 }, (_, index) => (
              <UpcomingScheduleSkeleton key={index} />
            ))}
          </ul>
        </section>

        <section className="home-dashboard-loading__section">
          <SkeletonSectionHeader />
          <ul className="home-dashboard-loading__unscheduled-list">
            {Array.from({ length: 3 }, (_, index) => (
              <UnscheduledTaskSkeleton key={index} />
            ))}
          </ul>
        </section>
      </div>

      <section
        aria-hidden="true"
        className="home-dashboard-loading__section home-dashboard-loading__recommended"
      >
        <SkeletonSectionHeader />
        <ul className="home-dashboard-loading__recommended-list">
          {Array.from({ length: 4 }, (_, index) => (
            <RecommendedScheduleSkeleton key={index} />
          ))}
        </ul>
      </section>
    </section>
  );
}

export function HomeScheduleDashboard({
  viewModel,
}: HomeScheduleDashboardProps) {
  const { status } = viewModel;

  switch (status) {
    case "loading":
      return (
        <HomeScheduleDashboardLoading loadingLabel={viewModel.loadingLabel} />
      );
    default:
      return assertNever(status);
  }
}
