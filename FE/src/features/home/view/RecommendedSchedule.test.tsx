import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { RecommendedSchedule } from "./RecommendedSchedule";
import type { RecommendedScheduleItemViewModel } from "../view-model/createRecommendedScheduleViewModel";

describe("추천 할 일 추가 상태", () => {
  it.each(["idle", "adding", "added", "error"] as const)(
    "%s 동작은 표시 문구에 의존하지 않는다",
    (addActionStatus) => {
      const onAdd = vi.fn();
      const item: RecommendedScheduleItemViewModel = {
        addActionStatus,
        addActionLabel: "다른 문구",
        categoryLabel: "웨딩홀",
        catalogItemId: 101,
        title: "웨딩홀 투어",
      };
      render(
        <MemoryRouter>
          <RecommendedSchedule
            onAddTask={onAdd}
            viewModel={{ title: "추천 할 일", items: [item] }}
          />
        </MemoryRouter>,
      );
      const button = screen.getByRole<HTMLButtonElement>("button", {
        name: "다른 문구",
      });
      expect(button.disabled).toBe(addActionStatus === "added");
      expect(button.getAttribute("aria-busy") === "true").toBe(
        addActionStatus === "adding",
      );
      fireEvent.click(button);
      expect(onAdd).toHaveBeenCalledTimes(
        addActionStatus === "idle" || addActionStatus === "error" ? 1 : 0,
      );
    },
  );
});
