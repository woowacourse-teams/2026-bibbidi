import type { MouseEvent, Ref } from "react";

import { AccordionPrimitive } from "../../../components/accordion";
import type { ChecklistGroupViewModel } from "../view-model/createChecklistViewModel";
import { ChecklistGroup } from "./ChecklistGroup";
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
    <AccordionPrimitive.Root
      className="checklist__groups"
      headingLevel={2}
      type="multiple"
      value={value}
      onValueChange={onValueChange}
    >
      {groups.map((group, groupIndex) => (
        <ChecklistGroup
          key={group.id}
          group={group}
          triggerRef={groupIndex === 0 ? firstGroupTriggerRef : undefined}
          selectedTaskId={selectedTaskId}
          detailId={detailId}
          onSelectTask={onSelectTask}
          onTaskButtonRef={onTaskButtonRef}
        />
      ))}
    </AccordionPrimitive.Root>
  );
}
