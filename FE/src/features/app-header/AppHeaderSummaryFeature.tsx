import { appHeaderSummaryMock } from "./model/appHeaderSummary.mock";
import { createAppHeaderSummaryViewModel } from "./view-model/createAppHeaderSummaryViewModel";
import { AppHeaderSummary } from "./view/AppHeaderSummary";

const viewModel = createAppHeaderSummaryViewModel(appHeaderSummaryMock);

export function AppHeaderSummaryFeature() {
  return <AppHeaderSummary viewModel={viewModel} />;
}
