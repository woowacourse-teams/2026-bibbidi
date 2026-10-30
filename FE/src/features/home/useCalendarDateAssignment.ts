import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import type {
  CalendarPlanningLoadState,
  CalendarPlanningTask,
} from "./model/calendarPlanning";

export function useCalendarDateAssignment({
  audience,
  checklistStatus,
  tasks,
  refreshChecklist,
}: {
  audience: "guest" | "authenticated" | undefined;
  checklistStatus: CalendarPlanningLoadState<unknown>["status"];
  tasks: readonly CalendarPlanningTask[];
  refreshChecklist: () => void;
}) {
  const [selectedTask, setSelectedTask] = useState<CalendarPlanningTask | null>(
    null,
  );
  const [loginTask, setLoginTask] = useState<CalendarPlanningTask | null>(null);
  const [focusDate, setFocusDate] = useState<string>();
  const [focusDateRevision, setFocusDateRevision] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestDate = (task: CalendarPlanningTask) => {
    if (audience === "guest") setLoginTask(task);
    else if (task.checklistItemId !== null) setSelectedTask(task);
  };
  const pendingCatalogId = searchParams.get("dateFor");
  useEffect(() => {
    if (
      audience !== "authenticated" ||
      checklistStatus !== "complete" ||
      !pendingCatalogId
    )
      return;
    const task = tasks.find(
      (item) => String(item.sourceCatalogItemId) === pendingCatalogId,
    );
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (task && task.checklistItemId !== null) setSelectedTask(task);
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete("dateFor");
          return next;
        },
        { replace: true },
      );
    });
    return () => {
      active = false;
    };
  }, [audience, checklistStatus, tasks, pendingCatalogId, setSearchParams]);
  const closeDate = useCallback(() => setSelectedTask(null), []);
  const onSaved = useCallback(
    (date: string) => {
      setFocusDate(date);
      setFocusDateRevision((value) => value + 1);
      refreshChecklist();
    },
    [refreshChecklist],
  );

  return {
    selectedTask,
    loginTask,
    focusDate,
    focusDateRevision,
    requestDate,
    closeDate,
    onSaved,
    closeLogin: () => setLoginTask(null),
    loginTo: loginTask
      ? `/calendar?dateFor=${loginTask.sourceCatalogItemId}`
      : undefined,
  };
}
