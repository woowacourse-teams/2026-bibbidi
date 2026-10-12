import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";

import { recommendedTasks } from "../model/exampleChat";
import { useExampleTaskAddition } from "./useExampleTaskAddition";

it("모바일에서 담은 항목을 PC에서 확인한 뒤 모바일로 돌아와도 목록과 완료 기록을 유지한다", () => {
  const { result, rerender } = renderHook(
    ({ isMobile }) => useExampleTaskAddition({ audience: "guest", isMobile }),
    { initialProps: { isMobile: true } },
  );
  act(() => {
    result.current.add(recommendedTasks[0]);
  });
  expect(result.current.visibleCount).toBe(0);
  rerender({ isMobile: false });
  expect(result.current.visibleCount).toBe(1);
  act(() => {
    result.current.completeTask(recommendedTasks[0].title);
  });
  rerender({ isMobile: true });
  expect(result.current.visibleCount).toBe(1);
  expect(result.current.completedCount).toBe(1);
});
