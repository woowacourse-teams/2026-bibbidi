import { useId } from "react";
import type { MouseEvent, Ref } from "react";
import { AccordionPrimitive } from "../../../components/accordion";
import { ChevronDown } from "../../../components/icons/Chevron";
import { ProgressBar } from "../../../components/progress-bar";
import type { ChecklistGroupViewModel } from "../view-model/createChecklistViewModel";
import { ChecklistTaskRow } from "./ChecklistTaskRow";

interface ChecklistGroupProps {
  group: ChecklistGroupViewModel;
  triggerRef?: Ref<HTMLButtonElement>;
  selectedTaskId: string | null;
  detailId: string;
  onSelectTask: (taskId: string, event: MouseEvent<HTMLButtonElement>) => void;
  onTaskButtonRef: (taskId: string, button: HTMLButtonElement | null) => void;
}

export function ChecklistGroup({
  group,
  triggerRef,
  selectedTaskId,
  detailId,
  onSelectTask,
  onTaskButtonRef,
}: ChecklistGroupProps) {
  const titleId = useId();
  return (
    <AccordionPrimitive.Item className="checklist__group" value={group.id}>
      <AccordionPrimitive.Header className="checklist__group-header">
        <AccordionPrimitive.Trigger
          className="checklist__group-trigger"
          aria-labelledby={titleId}
          ref={triggerRef}
        >
          <span className="checklist__group-number" aria-hidden="true">
            {group.numberLabel}
          </span>
          <span className="checklist__group-title" id={titleId}>
            {group.title}
          </span>
          <ChevronDown
            className="checklist__group-chevron"
            aria-hidden="true"
          />
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
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
      <AccordionPrimitive.Content className="checklist__group-content">
        <ul aria-label={`${group.title} 할 일`} className="checklist__tasks">
          {group.tasks.map((task, taskIndex) => (
            <li key={task.id}>
              <ChecklistTaskRow
                task={task}
                selected={selectedTaskId === task.id}
                first={taskIndex === 0}
                detailId={detailId}
                onClick={(event) => onSelectTask(task.id, event)}
                ref={(button) => onTaskButtonRef(task.id, button)}
              />
            </li>
          ))}
        </ul>
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
}
