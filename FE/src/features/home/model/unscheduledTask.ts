export type UnscheduledTaskStatus = "in-progress";

export interface UnscheduledTaskModel {
  category: string;
  id: string;
  status: UnscheduledTaskStatus;
  title: string;
}

export interface UnscheduledTaskListModel {
  tasks: UnscheduledTaskModel[];
}
