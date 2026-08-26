import { homeHeaderSummaryMock } from "./model/homeHeaderSummary.mock";
import { createHomeHeaderSummaryViewModel } from "./view-model/createHomeHeaderSummaryViewModel";
import { HomeHeaderSummary } from "./view/HomeHeaderSummary";

const viewModel = createHomeHeaderSummaryViewModel(homeHeaderSummaryMock);

export function HomeHeaderSummaryFeature() {
  return <HomeHeaderSummary viewModel={viewModel} />;
}
