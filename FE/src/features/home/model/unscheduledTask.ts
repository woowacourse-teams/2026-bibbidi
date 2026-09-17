export type UnscheduledTaskStatus = "continue" | "prev";

export interface UnscheduledTaskModel {
  category: string;
  id: number;
  status: UnscheduledTaskStatus;
  title: string;
}

export interface UnscheduledTaskListModel {
  tasks: UnscheduledTaskModel[];
}
