import type { RecommendedScheduleViewModel } from "../view-model/createRecommendedScheduleViewModel";
import { RecommendedSchedule } from "./RecommendedSchedule";
import { CalendarRecommendedState } from "./CalendarRecommendedState";

const starterMessages = {
  loading: "할 일을 불러오고 있어요.",
  error: "할 일을 불러오지 못했어요.",
  empty: "로드맵에서 준비할 일을 찾아보세요.",
};

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
  return status === "complete" && viewModel.items.length > 0 ? (
    <RecommendedSchedule onAddTask={onAddTask} viewModel={viewModel} />
  ) : (
    <CalendarRecommendedState
      status={status}
      messages={starterMessages}
      onRetry={onRetry}
    />
  );
}
