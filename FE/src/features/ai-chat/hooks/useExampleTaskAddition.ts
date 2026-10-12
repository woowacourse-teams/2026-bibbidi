import { useCallback, useState } from "react";

import type { ExampleRecommendedTask } from "../model/exampleChat";

interface ExampleTaskAdditionState {
  audience: string | null;
  tasks: ExampleRecommendedTask[];
  visibleCount: number;
  completedCount: number;
  focusRequest: number;
  isChatOpen: boolean;
}

function createEmptyState(audience: string | null): ExampleTaskAdditionState {
  return {
    audience,
    tasks: [],
    visibleCount: 0,
    completedCount: 0,
    focusRequest: 0,
    isChatOpen: false,
  };
}

export function useExampleTaskAddition({
  audience,
  isMobile,
}: {
  audience: string | null;
  isMobile: boolean;
}) {
  const [state, setState] = useState(() => createEmptyState(audience));
  // 인증 확인 중에는 기존 기록을 보존하고, 실제 사용자가 바뀌면 함께 초기화한다.
  if (audience !== null && state.audience !== audience) {
    setState(createEmptyState(audience));
  } else if (!isMobile && state.visibleCount < state.tasks.length) {
    // PC에서 확인한 목록은 모바일로 돌아온 뒤에도 유지한다.
    setState({ ...state, visibleCount: state.tasks.length });
  }
  const current =
    audience === null || state.audience === audience
      ? state
      : createEmptyState(audience);

  const add = (task: ExampleRecommendedTask) => {
    if (current.tasks.some((item) => item.title === task.title)) return false;
    setState((previous) => {
      if (
        previous.audience !== audience ||
        previous.tasks.some((item) => item.title === task.title)
      )
        return previous;
      const tasks = [...previous.tasks, task];
      return {
        ...previous,
        tasks,
        visibleCount: isMobile ? previous.visibleCount : tasks.length,
        focusRequest: previous.focusRequest + (isMobile ? 0 : 1),
      };
    });
    return true;
  };

  const showAddedTasks = () =>
    setState((previous) => ({
      ...previous,
      isChatOpen: false,
      visibleCount: previous.tasks.length,
      focusRequest: previous.focusRequest + 1,
    }));

  const setChatOpen = (isChatOpen: boolean) =>
    setState((previous) => ({ ...previous, isChatOpen }));

  const completeTask = useCallback(
    (title: string) => {
      setState((previous) =>
        previous.audience === audience &&
        previous.tasks[previous.completedCount]?.title === title
          ? { ...previous, completedCount: previous.completedCount + 1 }
          : previous,
      );
    },
    [audience],
  );

  return {
    tasks: current.tasks,
    addedTaskCount: current.tasks.length,
    visibleCount: isMobile ? current.visibleCount : current.tasks.length,
    completedCount: current.completedCount,
    focusRequest: current.focusRequest,
    isChatOpen: current.isChatOpen,
    isPaused: isMobile && current.isChatOpen,
    add,
    showAddedTasks,
    setChatOpen,
    completeTask,
  };
}

export type ExampleTaskAdditionController = ReturnType<
  typeof useExampleTaskAddition
>;
