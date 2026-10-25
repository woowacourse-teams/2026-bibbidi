import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WorkspaceLayout } from "./WorkspaceLayout";
import type { WorkspaceLayoutState } from "./layout";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("병렬 패널과 오버레이 전환에서 내용과 입력값을 유지하고 높이 측정을 전환한다", () => {
  const view = (asidePlacement: WorkspaceLayoutState["asidePlacement"]) => (
    <WorkspaceLayout
      layout={{ asidePlacement, navigationPlacement: "top", isMobile: false }}
      aside={<input aria-label="패널 메모" defaultValue="" />}
    >
      본문
    </WorkspaceLayout>
  );
  const { rerender } = render(view("docked"));
  const input = screen.getByRole("textbox", { name: "패널 메모" });
  const panel = input.parentElement!;
  expect(panel.style.getPropertyValue("--workspace-aside-height")).not.toBe("");
  fireEvent.change(input, { target: { value: "작성 중" } });

  rerender(view("overlay"));
  expect(screen.getByRole("textbox", { name: "패널 메모" })).toBe(input);
  expect((input as HTMLInputElement).value).toBe("작성 중");
  expect(panel.style.getPropertyValue("--workspace-aside-height")).toBe("");

  rerender(view("docked"));
  expect(screen.getByRole("textbox", { name: "패널 메모" })).toBe(input);
  expect(panel.style.getPropertyValue("--workspace-aside-height")).not.toBe("");
});
