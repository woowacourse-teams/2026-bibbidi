import { unscheduledTaskListMock } from "./model/unscheduledTask.mock";
import { createUnscheduledTaskViewModel } from "./view-model/createUnscheduledTaskViewModel";
import { UnscheduledTask } from "./view/UnscheduledTask";

const viewModel = createUnscheduledTaskViewModel(unscheduledTaskListMock);

export function UnscheduledTaskFeature() {
  return <UnscheduledTask viewModel={viewModel} />;
}
