import type { MouseEvent, Ref } from "react";

import { Accordion } from "../../../components/accordion";
import { ProgressBar } from "../../../components/progress-bar";
import type { ChecklistGroupViewModel } from "../view-model/createChecklistViewModel";
import { ChecklistTaskRow } from "./ChecklistTaskRow";
import "./ChecklistGroups.css";

interface ChecklistGroupsProps {
  groups: ChecklistGroupViewModel[];
  value: string[];
  onValueChange: (values: string[]) => void;
  selectedTaskId: string | null;
  detailId: string;
  firstGroupTriggerRef: Ref<HTMLButtonElement>;
  onSelectTask: (taskId: string, event: MouseEvent<HTMLButtonElement>) => void;
  onTaskButtonRef: (taskId: string, button: HTMLButtonElement | null) => void;
}

export function ChecklistGroups({
  groups,
  value,
  onValueChange,
  selectedTaskId,
  detailId,
  firstGroupTriggerRef,
  onSelectTask,
  onTaskButtonRef,
}: ChecklistGroupsProps) {
  return (
    <Accordion
      className="checklist__groups"
      headingLevel={2}
      type="multiple"
      variant="separated"
      value={value}
      onValueChange={onValueChange}
    >
      {groups.map((group, groupIndex) => (
        <Accordion.Item
          className="checklist__group"
          key={group.id}
          value={group.id}
          title={group.title}
          prefix={
            <span className="checklist__group-number">{group.numberLabel}</span>
          }
          triggerRef={groupIndex === 0 ? firstGroupTriggerRef : undefined}
          summary={
            <div className="checklist__group-progress">
              <div className="checklist__group-progress-label">
                <span className="checklist__group-count">
                  {group.countLabel} 완료
                </span>
                <span>{group.progressLabel}</span>
              </div>
              <ProgressBar
                aria-label={`${group.title} 진행률`}
                aria-valuetext={`${group.countLabel} 완료, ${group.progressLabel}`}
                progress={group.progress / 100}
                size="light"
              />
            </div>
          }
        >
          <ul aria-label={`${group.title} 할 일`} className="checklist__tasks">
            {group.tasks.map((task, taskIndex) => {
              const isSelected = selectedTaskId === task.id;

              return (
                <li key={task.id}>
                  <ChecklistTaskRow
                    task={task}
                    selected={isSelected}
                    first={taskIndex === 0}
                    detailId={detailId}
                    onClick={(event) => onSelectTask(task.id, event)}
                    ref={(button) => {
                      onTaskButtonRef(task.id, button);
                    }}
                  />
                </li>
              );
            })}
          </ul>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}
