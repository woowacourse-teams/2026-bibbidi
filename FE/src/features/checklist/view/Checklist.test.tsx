import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChecklistQueryModel } from "../model/checklistQuery";
import { createChecklistViewModel } from "../view-model/createChecklistViewModel";
import { Checklist } from "./Checklist";

function createChecklistQuery(): ChecklistQueryModel {
  return {
    categories: [
      {
        id: "10",
        items: [
          {
            appointments: [
              {
                date: "2026-09-12",
                endTime: "2026-09-12T20:30:00",
                id: 2,
                isDone: false,
                memo: "계약 조건 확인",
                place: "온라인",
                startTime: "2026-09-12T19:00:00",
                title: "계약서 검토",
              },
              {
                date: "2026-09-08",
                endTime: null,
                id: 1,
                isDone: true,
                memo: null,
                place: null,
                startTime: null,
                title: "계약금 입금",
              },
            ],
            categoryId: "10",
            checklistItemId: 10,
            id: "checklist-item-10",
            isDone: false,
            sourceCatalogItemId: 101,
            title: "웨딩홀 계약",
          },
          {
            appointments: [],
            categoryId: "10",
            checklistItemId: 11,
            id: "checklist-item-11",
            isDone: true,
            sourceCatalogItemId: 102,
            title: "웨딩홀 투어",
          },
        ],
        title: "예식장",
      },
    ],
  };
}

function setDesktopDetailPanelSupport(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      matches,
      media: "(min-width: 761px)",
      onchange: null,
      removeEventListener: vi.fn(),
    }),
  );
}

function ChecklistHarness({
  categories = createChecklistViewModel(createChecklistQuery()),
  initialSelectedTaskId = null,
}: {
  categories?: ReturnType<typeof createChecklistViewModel>;
  initialSelectedTaskId?: string | null;
}) {
  const [selectedTaskId, setSelectedTaskId] = useState(initialSelectedTaskId);

  return (
    <Checklist
      categories={categories}
      onCloseTaskDetail={() => setSelectedTaskId(null)}
      onSelectTask={setSelectedTaskId}
      selectedTaskId={selectedTaskId}
    />
  );
}

beforeEach(() => {
  setDesktopDetailPanelSupport(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Checklist 웹 상세 패널", () => {
  it("선택한 할 일의 API 기반 상세 정보와 전체 일정을 서버 순서로 표시한다", () => {
    render(<ChecklistHarness />);

    fireEvent.click(screen.getByRole("button", { name: /웨딩홀 계약/ }));

    const panel = screen.getByRole("complementary", { name: "웨딩홀 계약" });
    expect(within(panel).getByText("예식장")).toBeTruthy();
    expect(within(panel).getByText("진행 중")).toBeTruthy();
    expect(
      within(panel)
        .getAllByRole("listitem")
        .map(
          (appointment) =>
            appointment.querySelector(
              ".checklist-detail-panel__appointment-title",
            )?.textContent,
        ),
    ).toEqual(["계약서 검토", "계약금 입금"]);
    expect(
      within(panel).getByText("오후 7시–오후 8시 30분 · 온라인"),
    ).toBeTruthy();
    expect(within(panel).getByText("계약 조건 확인")).toBeTruthy();
    expect(within(panel).getByText("시간 없음 · 장소 없음")).toBeTruthy();
    expect(within(panel).getByText("메모 없음")).toBeTruthy();
    expect(within(panel).getByLabelText("완료된 일정")).toBeTruthy();
  });

  it("다른 할 일을 선택하면 패널 내용을 교체하고 빈 일정 상태를 표시한다", () => {
    render(<ChecklistHarness />);

    fireEvent.click(screen.getByRole("button", { name: /웨딩홀 계약/ }));
    fireEvent.click(screen.getByRole("button", { name: /웨딩홀 투어/ }));

    const panel = screen.getByRole("complementary", { name: "웨딩홀 투어" });
    expect(within(panel).getByText("완료")).toBeTruthy();
    expect(
      within(panel).getByRole("heading", { name: "일정 0개" }),
    ).toBeTruthy();
    expect(within(panel).getByText("등록된 일정이 없어요.")).toBeTruthy();
    expect(
      screen.queryByRole("complementary", { name: "웨딩홀 계약" }),
    ).toBeNull();
  });

  it("닫기 버튼과 Escape 키로 패널을 닫고 선택한 항목으로 포커스를 돌린다", () => {
    render(<ChecklistHarness />);

    const firstTask = screen.getByRole("button", { name: /웨딩홀 계약/ });
    fireEvent.click(firstTask);
    fireEvent.click(screen.getByRole("button", { name: "할 일 상세 닫기" }));

    expect(screen.queryByRole("complementary")).toBeNull();
    expect(document.activeElement).toBe(firstTask);

    const secondTask = screen.getByRole("button", { name: /웨딩홀 투어/ });
    fireEvent.click(secondTask);
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("complementary")).toBeNull();
    expect(document.activeElement).toBe(secondTask);
  });

  it("선택 항목이 사라지면 stale 상세와 unmount된 선택 버튼 ref를 사용하지 않는다", () => {
    const onCloseTaskDetail = vi.fn();
    const onSelectTask = vi.fn();
    const categories = createChecklistViewModel(createChecklistQuery());
    const view = render(
      <Checklist
        categories={categories}
        onCloseTaskDetail={onCloseTaskDetail}
        onSelectTask={onSelectTask}
        selectedTaskId="checklist-item-10"
      />,
    );
    const removedTaskButton = screen.getByRole("button", {
      name: /웨딩홀 계약/,
    });

    view.rerender(
      <Checklist
        categories={createChecklistViewModel({
          categories: [{ id: "10", items: [], title: "예식장" }],
        })}
        onCloseTaskDetail={onCloseTaskDetail}
        onSelectTask={onSelectTask}
        selectedTaskId="checklist-item-10"
      />,
    );

    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByText("계약 조건 확인")).toBeNull();

    view.rerender(
      <Checklist
        categories={createChecklistViewModel({
          categories: [{ id: "10", items: [], title: "예식장" }],
        })}
        onCloseTaskDetail={onCloseTaskDetail}
        onSelectTask={onSelectTask}
        selectedTaskId={null}
      />,
    );

    expect(removedTaskButton.isConnected).toBe(false);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "예식장" }),
    );
  });

  it("모바일에서는 상세 패널을 열지 않고 기존 목록을 유지한다", () => {
    setDesktopDetailPanelSupport(false);
    render(<ChecklistHarness />);

    const task = screen.getByRole("button", { name: /웨딩홀 계약/ });
    expect(task.hasAttribute("disabled")).toBe(true);
    fireEvent.click(task);

    expect(screen.queryByRole("complementary")).toBeNull();
  });
});
