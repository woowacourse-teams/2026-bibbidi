import { upcomingScheduleListMock } from "./model/upcomingSchedule.mock";
import { createUpcomingScheduleViewModel } from "./view-model/createUpcomingScheduleViewModel";
import { UpcomingSchedule } from "./view/UpcomingSchedule";

const viewModel = createUpcomingScheduleViewModel(upcomingScheduleListMock);

export function UpcomingScheduleFeature() {
  return <UpcomingSchedule viewModel={viewModel} />;
}
