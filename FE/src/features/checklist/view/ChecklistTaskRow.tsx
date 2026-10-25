import type { ComponentPropsWithRef } from "react";

import { Badge, type BadgeColor } from "../../../components/badge";
import { ListRow } from "../../../components/list-row";
import type { ChecklistTaskViewModel } from "../view-model/createChecklistViewModel";

const statusColors: Record<ChecklistTaskViewModel["status"], BadgeColor> = {
  incomplete: "dark",
  "in-progress": "primary",
  complete: "positive",
};

interface ChecklistTaskRowProps {
  task: Pick<
    ChecklistTaskViewModel,
    "title" | "schedule" | "status" | "statusLabel"
  >;
  selected: boolean;
  detailId: string;
  first: boolean;
  onClick: NonNullable<ComponentPropsWithRef<"button">["onClick"]>;
  ref?: ComponentPropsWithRef<"button">["ref"];
}

export function ChecklistTaskRow({
  task,
  selected,
  detailId,
  first,
  onClick,
  ref,
}: ChecklistTaskRowProps) {
  return (
    <ListRow
      ref={ref}
      aria-controls={selected ? detailId : undefined}
      aria-expanded={selected}
      selected={selected}
      border={first ? "none" : "indented"}
      contents={<ListRow.Texts top={task.title} bottom={task.schedule} />}
      right={
        <Badge color={statusColors[task.status]} variant="weak" size="small">
          {task.statusLabel}
        </Badge>
      }
      withArrow
      onClick={onClick}
    />
  );
}
