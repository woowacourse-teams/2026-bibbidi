import { Link } from "react-router";
import { Button } from "../../../components/button";
import { ListHeader } from "../../../components/list-header";
import { ListRow } from "../../../components/list-row";

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
    <>
      {status === "complete" && viewModel.items.length > 0 ? (
        <RecommendedSchedule onAddTask={onAddTask} viewModel={viewModel} />
      ) : (
        <section
          aria-labelledby="guest-starter-tasks-title"
          className="calendar-planning__card"
        >
          <ListHeader
            titleId="guest-starter-tasks-title"
            title="추천 할 일"
            right={<Link to="/preparation">로드맵 전체 보기 ›</Link>}
          />
          {status === "loading" ? (
            <ListRow.Loader type="bar" aria-label="할 일을 불러오고 있어요." />
          ) : status === "error" ? (
            <>
              <p role="alert">할 일을 불러오지 못했어요.</p>
              <Button
                size="small"
                color="dark"
                variant="weak"
                className="calendar-planning__retry"
                onClick={onRetry}
              >
                다시 시도
              </Button>
            </>
          ) : (
            <p>로드맵에서 준비할 일을 찾아보세요.</p>
          )}
        </section>
      )}
    </>
  );
}
