import { recommendedScheduleListMock } from "./model/recommendedSchedule.mock";
import { createRecommendedScheduleViewModel } from "./view-model/createRecommendedScheduleViewModel";
import { RecommendedSchedule } from "./view/RecommendedSchedule";

const viewModel = createRecommendedScheduleViewModel(
  recommendedScheduleListMock,
);

export function RecommendedScheduleFeature() {
  return <RecommendedSchedule viewModel={viewModel} />;
}
