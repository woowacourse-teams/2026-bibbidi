import type { ComponentPropsWithRef } from "react";

import { ListRow } from "../../../components/list-row";
import type { ChecklistTaskViewModel } from "../view-model/createChecklistViewModel";
import { ChecklistTaskStatusBadge } from "./ChecklistTaskStatusBadge";

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
        <ChecklistTaskStatusBadge
          status={task.status}
          label={task.statusLabel}
        />
      }
      withArrow
      onClick={onClick}
    />
  );
}
