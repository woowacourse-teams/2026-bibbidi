import { Badge, type BadgeColor } from "../../../components/badge";
import type { ChecklistTaskStatus } from "../model/checklist";

const statusColors: Record<ChecklistTaskStatus, BadgeColor> = {
  incomplete: "dark",
  "in-progress": "primary",
  complete: "positive",
};

export function ChecklistTaskStatusBadge({
  status,
  label,
}: {
  status: ChecklistTaskStatus;
  label: string;
}) {
  return (
    <Badge color={statusColors[status]} variant="weak" size="small">
      {label}
    </Badge>
  );
}
