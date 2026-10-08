import { Link } from "react-router";

import type { RecommendedScheduleViewModel } from "../view-model/createRecommendedScheduleViewModel";
import { RecommendedSchedule } from "./RecommendedSchedule";

export function GuestRecommendedTasks({
  status,
  viewModel,
  onAddTask,
  onRetry,
}: {
  status: "loading" | "error" | "complete";
  viewModel: RecommendedScheduleViewModel;
  onAddTask: (catalogItemId: number) => void;
  onRetry: () => void;
}) {
  return (
    <div className="home-dashboard-guest__recommendations">
      {status === "complete" && viewModel.items.length > 0 ? (
        <RecommendedSchedule
          compact
          onAddTask={onAddTask}
          viewModel={viewModel}
        />
      ) : (
        <section
          aria-labelledby="guest-starter-tasks-title"
          className="calendar-planning__card"
        >
          <header>
            <h2 id="guest-starter-tasks-title">추천 할 일</h2>
            <Link to="/preparation">로드맵 전체 보기 ›</Link>
          </header>
          {status === "loading" ? (
            <p role="status">할 일을 불러오고 있어요.</p>
          ) : status === "error" ? (
            <>
              <p role="alert">할 일을 불러오지 못했어요.</p>
              <button
                type="button"
                className="home-dashboard-state__result-action home-dashboard-state__result-action--button"
                onClick={onRetry}
              >
                다시 시도
              </button>
            </>
          ) : (
            <p>로드맵에서 준비할 일을 찾아보세요.</p>
          )}
        </section>
      )}
    </div>
  );
}
