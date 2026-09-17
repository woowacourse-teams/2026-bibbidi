import { useState } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChecklistQueryModel } from "../model/checklistQuery";
import {
  ChecklistItemCategoryEditSession,
  ChecklistItemChangeFeedback,
  ChecklistItemEditingController,
  ChecklistItemStatusConfirmation,
  ChecklistItemStatusEditSession,
  ChecklistItemTitleEditSession,
} from "../model/checklistEditing";
import { createChecklistViewModel } from "../view-model/createChecklistViewModel";
import { MOBILE_LAYOUT_MEDIA_QUERY } from "../../../shared/responsive";
import { installMatchMedia } from "../../../test/matchMedia";
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
            sourceCatalogItemId: 101,
            status: "continue",
            title: "웨딩홀 계약",
          },
          {
            appointments: [],
            categoryId: "10",
            checklistItemId: 11,
            id: "checklist-item-11",
            sourceCatalogItemId: 102,
            status: "done",
            title: "웨딩홀 투어",
          },
        ],
        title: "예식장",
      },
    ],
  };
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
      onBackTaskDetail={() => setSelectedTaskId(null)}
      onCloseTaskDetail={() => setSelectedTaskId(null)}
      onSelectTask={setSelectedTaskId}
      selectedTaskId={selectedTaskId}
    />
  );
}

function createEditableChecklistQuery(): ChecklistQueryModel {
  return {
    categories: [
      {
        id: "10",
        items: [
          {
            appointments: [],
            categoryId: "10",
            checklistItemId: 500,
            id: "checklist-item-500",
            sourceCatalogItemId: null,
            status: "prev",
            title: "청첩장 문구 정하기",
          },
          {
            appointments: [],
            categoryId: "10",
            checklistItemId: 501,
            id: "checklist-item-501",
            sourceCatalogItemId: 101,
            status: "prev",
            title: "준비 목록 항목",
          },
        ],
        title: "예식 준비",
      },
      { id: "20", items: [], title: "예복 준비" },
    ],
  };
}

function EditableChecklistHarness({
  changeCategory = vi.fn().mockResolvedValue(true),
  confirmStatusChange = vi.fn().mockResolvedValue(true),
  changeTitle = vi.fn().mockResolvedValue(true),
  requestStatusChange = vi.fn().mockResolvedValue("changed"),
  initialSelectedTaskId = "checklist-item-500",
}: {
  changeCategory?: (itemId: number, categoryId: string) => Promise<boolean>;
  confirmStatusChange?: (itemId: number) => Promise<boolean>;
  changeTitle?: (itemId: number, title: string) => Promise<boolean>;
  requestStatusChange?: ChecklistItemEditingController["requestStatusChange"];
  initialSelectedTaskId?: string | null;
}) {
  const [checklist, setChecklist] = useState(createEditableChecklistQuery);
  const [selectedTaskId, setSelectedTaskId] = useState(initialSelectedTaskId);
  const [categoryEditSession, setCategoryEditSession] =
    useState<ChecklistItemCategoryEditSession | null>(null);
  const [titleEditSession, setTitleEditSession] =
    useState<ChecklistItemTitleEditSession | null>(null);
  const [statusEditSession, setStatusEditSession] =
    useState<ChecklistItemStatusEditSession | null>(null);
  const [statusConfirmation, setStatusConfirmation] =
    useState<ChecklistItemStatusConfirmation | null>(null);
  const [changeFeedback, setChangeFeedback] =
    useState<ChecklistItemChangeFeedback>({ status: "idle" });

  const updateCategory = (itemId: number, categoryId: string) => {
    setChecklist((current) => {
      const changedItem = current.categories
        .flatMap((category) => category.items)
        .find((item) => item.checklistItemId === itemId);

      if (!changedItem) {
        return current;
      }

      return {
        categories: current.categories.map((category) => ({
          ...category,
          items: [
            ...category.items.filter((item) => item.checklistItemId !== itemId),
            ...(category.id === categoryId
              ? [{ ...changedItem, categoryId }]
              : []),
          ],
        })),
      };
    });
  };

  const updateTitle = (itemId: number, title: string) => {
    setChecklist((current) => ({
      categories: current.categories.map((category) => ({
        ...category,
        items: category.items.map((item) =>
          item.checklistItemId === itemId ? { ...item, title } : item,
        ),
      })),
    }));
  };

  const editing: ChecklistItemEditingController = {
    categoryEditSession,
    cancelStatusChange(itemId) {
      setStatusConfirmation((current) =>
        current?.itemId === itemId ? null : current,
      );
    },
    async changeCategory(itemId, categoryId) {
      setChangeFeedback({ itemId, kind: "category", status: "pending" });
      const didChange = await changeCategory(itemId, categoryId);

      if (didChange) {
        updateCategory(itemId, categoryId);
        setChangeFeedback({ status: "idle" });
      } else {
        setChangeFeedback({
          errorMessage: "카테고리를 변경하지 못했습니다.",
          itemId,
          kind: "category",
          status: "error",
        });
      }

      return didChange;
    },
    changeFeedback,
    async confirmStatusChange(itemId) {
      setChangeFeedback({ itemId, kind: "status", status: "pending" });
      const didChange = await confirmStatusChange(itemId);

      if (didChange) {
        setChecklist((current) => ({
          categories: current.categories.map((category) => ({
            ...category,
            items: category.items.map((item) =>
              item.checklistItemId === itemId
                ? { ...item, status: "done" }
                : item,
            ),
          })),
        }));
        setStatusConfirmation(null);
        setChangeFeedback({ status: "idle" });
      }

      return didChange;
    },
    async requestStatusChange(itemId, status) {
      setChangeFeedback({ itemId, kind: "status", status: "pending" });
      const result = await requestStatusChange(itemId, status);

      if (result === "confirmation-required") {
        setChangeFeedback({ status: "idle" });
        setStatusConfirmation({ itemId, status: "done" });
      } else if (result === "changed") {
        setChangeFeedback({ status: "idle" });
        setChecklist((current) => ({
          categories: current.categories.map((category) => ({
            ...category,
            items: category.items.map((item) =>
              item.checklistItemId === itemId ? { ...item, status } : item,
            ),
          })),
        }));
      } else {
        setChangeFeedback({
          errorMessage: "남은 일정을 확인하지 못했습니다.",
          itemId,
          kind: "status",
          status: "error",
        });
      }

      return result;
    },
    async changeTitle(itemId, title) {
      setChangeFeedback({ itemId, kind: "title", status: "pending" });
      const didChange = await changeTitle(itemId, title);

      if (didChange) {
        updateTitle(itemId, title);
        setChangeFeedback({ status: "idle" });
      } else {
        setChangeFeedback({
          errorMessage: "제목을 변경하지 못했습니다.",
          itemId,
          kind: "title",
          status: "error",
        });
      }

      return didChange;
    },
    clearError(itemId) {
      const clear = (current: ChecklistItemChangeFeedback) =>
        current.status === "error" && current.itemId === itemId
          ? ({ status: "idle" } as const)
          : current;

      setChangeFeedback(clear);
    },
    finishCategoryEditing(itemId) {
      setCategoryEditSession((current) =>
        current?.itemId === itemId ? null : current,
      );
    },
    finishTitleEditing(itemId) {
      setTitleEditSession((current) =>
        current?.itemId === itemId ? null : current,
      );
    },
    finishStatusEditing(itemId) {
      setStatusEditSession((current) =>
        current?.itemId === itemId ? null : current,
      );
    },
    startCategoryEditing(itemId) {
      setTitleEditSession(null);
      setStatusEditSession(null);
      setCategoryEditSession({ itemId });
    },
    startStatusEditing(itemId) {
      setCategoryEditSession(null);
      setTitleEditSession(null);
      setStatusEditSession({ itemId });
    },
    startTitleEditing(itemId, title) {
      setCategoryEditSession(null);
      setStatusEditSession(null);
      setTitleEditSession({ draft: title, itemId });
    },
    statusConfirmation,
    statusEditSession,
    titleEditSession,
    updateTitleDraft(itemId, draft) {
      setTitleEditSession((current) =>
        current?.itemId === itemId ? { draft, itemId } : current,
      );
    },
  };

  return (
    <Checklist
      categories={createChecklistViewModel(checklist)}
      itemEditing={editing}
      onBackTaskDetail={() => setSelectedTaskId(null)}
      onCloseTaskDetail={() => setSelectedTaskId(null)}
      onSelectTask={setSelectedTaskId}
      selectedTaskId={selectedTaskId}
    />
  );
}

beforeEach(() => {
  installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, false);
});

afterEach(() => {
  vi.restoreAllMocks();
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
              ".checklist-detail-content__appointment-title",
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
        onBackTaskDetail={onCloseTaskDetail}
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
        onBackTaskDetail={onCloseTaskDetail}
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
        onBackTaskDetail={onCloseTaskDetail}
        onCloseTaskDetail={onCloseTaskDetail}
        onSelectTask={onSelectTask}
        selectedTaskId={null}
      />,
    );

    expect(removedTaskButton.isConnected).toBe(false);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "할 일 추가" }),
    );
  });

  it("모바일에서는 공통 상세 콘텐츠를 바텀시트로 표시하고 배경 목록과 스크롤을 비활성화한다", () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    const { container } = render(
      <div data-page-scroll-container>
        <ChecklistHarness />
      </div>,
    );

    const task = screen.getByRole("button", { name: /웨딩홀 계약/ });
    fireEvent.click(task);

    expect(screen.queryByRole("complementary")).toBeNull();
    const bottomSheet = screen.getByRole("dialog", { name: "웨딩홀 계약" });
    expect(bottomSheet.getAttribute("aria-modal")).toBe("true");
    expect(within(bottomSheet).getByText("예식장")).toBeTruthy();
    expect(within(bottomSheet).getByText("계약 조건 확인")).toBeTruthy();
    expect(document.activeElement).toBe(
      within(bottomSheet).getByRole("button", {
        name: "아래로 밀어 할 일 상세 닫기",
      }),
    );
    expect(
      within(bottomSheet).queryByRole("button", {
        name: "할 일 상세 닫기",
      }),
    ).toBeNull();

    const background = document.querySelector(".checklist-workspace__main");
    const scrollContainer = container.querySelector<HTMLElement>(
      "[data-page-scroll-container]",
    );
    expect(background?.getAttribute("aria-hidden")).toBe("true");
    expect(background?.hasAttribute("inert")).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    expect(scrollContainer?.style.overflow).toBe("hidden");

    fireEvent.keyDown(bottomSheet, { key: "Escape" });

    expect(
      bottomSheet.closest(".checklist-detail-bottom-sheet")?.className,
    ).toContain("bottom-sheet-dismiss--closing");
    expect(screen.getByRole("dialog", { name: "웨딩홀 계약" })).toBe(
      bottomSheet,
    );
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.transitionEnd(bottomSheet, { propertyName: "transform" });

    expect(screen.queryByRole("dialog", { name: "웨딩홀 계약" })).toBeNull();
    expect(document.activeElement).toBe(task);
    expect(document.body.style.overflow).toBe("");
    expect(scrollContainer?.style.overflow).toBe("");
  });

  it("모바일 바텀시트는 스크림과 드래그 핸들로 닫고 짧은 드래그는 복원한다", () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    render(<ChecklistHarness />);

    const task = screen.getByRole("button", { name: /웨딩홀 계약/ });
    fireEvent.click(task);
    let bottomSheet = screen.getByRole("dialog", { name: "웨딩홀 계약" });
    let sheetRoot = bottomSheet.closest(
      ".checklist-detail-bottom-sheet",
    ) as HTMLElement;
    const handle = within(bottomSheet).getByRole("button", {
      name: "아래로 밀어 할 일 상세 닫기",
    });
    vi.spyOn(bottomSheet, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ height: 600 }),
    );

    fireEvent.pointerDown(handle, {
      button: 0,
      clientY: 100,
      pointerId: 1,
      pointerType: "touch",
    });
    fireEvent.pointerMove(handle, {
      clientY: 160,
      pointerId: 1,
      pointerType: "touch",
    });
    expect(sheetRoot.style.getPropertyValue("--bottom-sheet-drag-offset")).toBe(
      "60px",
    );
    fireEvent.pointerUp(handle, {
      clientY: 160,
      pointerId: 1,
      pointerType: "touch",
    });

    expect(sheetRoot.className).not.toContain("bottom-sheet-dismiss--closing");
    expect(sheetRoot.style.getPropertyValue("--bottom-sheet-drag-offset")).toBe(
      "0px",
    );

    fireEvent.pointerDown(handle, {
      button: 0,
      clientY: 100,
      pointerId: 2,
      pointerType: "touch",
    });
    fireEvent.pointerMove(handle, {
      clientY: 210,
      pointerId: 2,
      pointerType: "touch",
    });
    fireEvent.pointerUp(handle, {
      clientY: 210,
      pointerId: 2,
      pointerType: "touch",
    });

    expect(sheetRoot.className).toContain("bottom-sheet-dismiss--closing");
    fireEvent.transitionEnd(bottomSheet, { propertyName: "transform" });
    expect(screen.queryByRole("dialog", { name: "웨딩홀 계약" })).toBeNull();
    expect(document.activeElement).toBe(task);

    fireEvent.click(task);
    bottomSheet = screen.getByRole("dialog", { name: "웨딩홀 계약" });
    sheetRoot = bottomSheet.closest(
      ".checklist-detail-bottom-sheet",
    ) as HTMLElement;
    fireEvent.click(
      document.querySelector(
        ".checklist-detail-bottom-sheet__scrim",
      ) as HTMLButtonElement,
    );
    expect(sheetRoot.className).toContain("bottom-sheet-dismiss--closing");
    fireEvent.transitionEnd(bottomSheet, { propertyName: "transform" });
    expect(screen.queryByRole("dialog", { name: "웨딩홀 계약" })).toBeNull();
    expect(document.activeElement).toBe(task);
  });

  it("모션 감소 설정에서는 모바일 바텀시트를 즉시 닫는다", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(
        (query: string) =>
          ({
            addEventListener: vi.fn(),
            addListener: vi.fn(),
            matches:
              query === MOBILE_LAYOUT_MEDIA_QUERY ||
              query === "(prefers-reduced-motion: reduce)",
            media: query,
            onchange: null,
            removeEventListener: vi.fn(),
            removeListener: vi.fn(),
          }) as unknown as MediaQueryList,
      ),
    );
    render(<ChecklistHarness />);

    fireEvent.click(screen.getByRole("button", { name: /웨딩홀 계약/ }));
    fireEvent.click(
      document.querySelector(
        ".checklist-detail-bottom-sheet__scrim",
      ) as HTMLButtonElement,
    );

    expect(screen.queryByRole("dialog", { name: "웨딩홀 계약" })).toBeNull();
  });

  it("모바일 바텀시트에서도 일정이 없으면 공통 빈 상태를 표시한다", () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    render(<ChecklistHarness />);

    fireEvent.click(screen.getByRole("button", { name: /웨딩홀 투어/ }));

    const detailPage = screen.getByRole("dialog", { name: "웨딩홀 투어" });
    expect(
      within(detailPage).getByRole("heading", { name: "일정 0개" }),
    ).toBeTruthy();
    expect(within(detailPage).getByText("등록된 일정이 없어요.")).toBeTruthy();
  });

  it("breakpoint 전환 시 선택을 유지하며 같은 공통 콘텐츠의 표현만 바꾼다", () => {
    const media = installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, false);
    render(<ChecklistHarness initialSelectedTaskId="checklist-item-10" />);

    expect(
      screen.getByRole("complementary", { name: "웨딩홀 계약" }),
    ).toBeTruthy();

    act(() => media.setMatches(true));

    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.getByRole("dialog", { name: "웨딩홀 계약" })).toBeTruthy();

    act(() => media.setMatches(false));

    expect(screen.queryByRole("dialog", { name: "웨딩홀 계약" })).toBeNull();
    expect(
      screen.getByRole("complementary", { name: "웨딩홀 계약" }),
    ).toBeTruthy();
  });
});

describe("Checklist 목록 표현", () => {
  it("비로그인 사용자에게 로그인 시 현재 체크리스트를 저장할 수 있다고 안내한다", () => {
    render(<ChecklistHarness />);

    expect(
      screen.getByText("로그인하면 체크리스트가 그대로 저장돼요."),
    ).toBeTruthy();
  });

  it("전체 할 일이 0개면 하나의 빈 상태 문구를 표시한다", () => {
    render(
      <ChecklistHarness
        categories={createChecklistViewModel({
          categories: [
            { id: "10", items: [], title: "예식장" },
            { id: "20", items: [], title: "스드메" },
          ],
        })}
      />,
    );

    expect(screen.getByText("등록된 할 일이 없어요.")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "예식장" })).toBeNull();
    expect(screen.getByRole("button", { name: "할 일 추가" })).toBeTruthy();
  });

  it("목록 왼쪽 체크 표시 없이 완료 배경과 상태 문구를 유지한다", () => {
    const { container } = render(<ChecklistHarness />);
    const completedTask = screen.getByRole("button", { name: /웨딩홀 투어/ });

    expect(container.querySelector(".checklist__completion-mark")).toBeNull();
    expect(completedTask.closest(".checklist__task--complete")).not.toBeNull();
    expect(within(completedTask).getByText("완료")).toBeTruthy();
  });
});

describe("Checklist 할 일 편집", () => {
  it("직접 작성 항목에만 제목과 카테고리 수정 동작을 노출한다", () => {
    render(<EditableChecklistHarness />);

    expect(
      screen.getByRole("button", { name: "할 일 제목 수정" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "카테고리 변경, 현재 예식 준비",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "상태 변경, 현재 예정" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /준비 목록 항목/ }));

    expect(
      screen.queryByRole("button", { name: "할 일 제목 수정" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /카테고리 변경/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: "상태 변경, 현재 예정" }),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("complementary")).getByText("예식 준비"),
    ).toBeTruthy();
  });

  it("상태 팝오버는 현재 상태와 세 옵션을 표시하고 같은 상태는 요청하지 않는다", async () => {
    const requestStatusChange = vi.fn().mockResolvedValue("changed");
    render(
      <EditableChecklistHarness requestStatusChange={requestStatusChange} />,
    );
    const trigger = screen.getByRole("button", {
      name: "상태 변경, 현재 예정",
    });

    fireEvent.click(trigger);
    const incomplete = screen.getByRole("option", { name: "예정" });
    const inProgress = screen.getByRole("option", { name: "진행 중" });
    const complete = screen.getByRole("option", { name: "완료" });
    expect(incomplete.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(incomplete);

    fireEvent.keyDown(incomplete, { key: "End" });
    expect(document.activeElement).toBe(complete);
    fireEvent.keyDown(complete, { key: "Home" });
    expect(document.activeElement).toBe(incomplete);
    fireEvent.keyDown(incomplete, { key: "ArrowDown" });
    expect(document.activeElement).toBe(inProgress);
    fireEvent.keyDown(inProgress, { key: "ArrowUp" });
    expect(document.activeElement).toBe(incomplete);

    fireEvent.click(incomplete);
    expect(requestStatusChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox", { name: "상태 선택" })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("상태 팝오버는 Escape와 바깥 클릭으로 닫고 트리거로 포커스를 복원한다", async () => {
    render(<EditableChecklistHarness />);
    const trigger = screen.getByRole("button", {
      name: "상태 변경, 현재 예정",
    });

    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("option", { name: "예정" }), {
      key: "Escape",
    });
    await waitFor(() => expect(document.activeElement).toBe(trigger));

    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox", { name: "상태 선택" })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("남은 일정 조회 실패는 완료 PUT 없이 팝오버에 접근 가능한 오류를 표시한다", async () => {
    const requestStatusChange = vi.fn().mockResolvedValue("failed");
    render(
      <EditableChecklistHarness requestStatusChange={requestStatusChange} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "상태 변경, 현재 예정" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "완료" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "남은 일정을 확인하지 못했습니다.",
    );
    expect(screen.getByRole("listbox", { name: "상태 선택" })).toBeTruthy();
    expect(requestStatusChange).toHaveBeenCalledOnce();
  });

  it("남은 일정이 있는 완료 선택은 확인 dialog를 표시하고 취소 뒤 포커스를 복원한다", async () => {
    const requestStatusChange = vi
      .fn()
      .mockResolvedValue("confirmation-required");
    render(
      <EditableChecklistHarness requestStatusChange={requestStatusChange} />,
    );
    const trigger = screen.getByRole("button", {
      name: "상태 변경, 현재 예정",
    });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "완료" }));

    const dialog = await screen.findByRole("dialog", {
      name: "남은 일정도 완료할까요?",
    });
    expect(within(dialog).getByText(/함께 완료돼요/)).toBeTruthy();
    expect(requestStatusChange).toHaveBeenCalledWith(500, "done");
    expect(document.activeElement).toBe(
      within(dialog).getByRole("button", { name: "취소" }),
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("완료 확인 dialog에서 함께 완료를 선택하면 완료 상태를 반영한다", async () => {
    render(
      <EditableChecklistHarness
        requestStatusChange={vi.fn().mockResolvedValue("confirmation-required")}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "상태 변경, 현재 예정" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "완료" }));
    const dialog = await screen.findByRole("dialog", {
      name: "남은 일정도 완료할까요?",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "함께 완료" }));

    expect(
      await screen.findByRole("button", { name: "상태 변경, 현재 완료" }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("progressbar", { name: "예식 준비 진행률" })
        .getAttribute("aria-valuenow"),
    ).toBe("50");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("완료 변경 중 Escape는 dialog에서 소비하고 활성 요청을 유지한다", async () => {
    let resolveStatusChange: (value: boolean) => void = () => undefined;
    const confirmStatusChange = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveStatusChange = resolve;
        }),
    );
    render(
      <EditableChecklistHarness
        confirmStatusChange={confirmStatusChange}
        requestStatusChange={vi.fn().mockResolvedValue("confirmation-required")}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "상태 변경, 현재 예정" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "완료" }));
    const dialog = await screen.findByRole("dialog", {
      name: "남은 일정도 완료할까요?",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "함께 완료" }));

    expect(
      within(dialog).getByRole("button", { name: "변경 중" }),
    ).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(document.querySelector(".checklist-detail-panel")).not.toBeNull();
    expect(confirmStatusChange).toHaveBeenCalledOnce();

    await act(async () => resolveStatusChange(true));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("상태 사전 조회 중 다른 항목을 선택하면 이전 항목 확인창을 표시하지 않는다", async () => {
    let resolveStatusChange: (value: "confirmation-required") => void = () =>
      undefined;
    const requestStatusChange = vi.fn().mockReturnValue(
      new Promise<"confirmation-required">((resolve) => {
        resolveStatusChange = resolve;
      }),
    );
    render(
      <EditableChecklistHarness requestStatusChange={requestStatusChange} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "상태 변경, 현재 예정" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "완료" }));
    fireEvent.click(screen.getByRole("button", { name: /준비 목록 항목/ }));

    await act(async () => resolveStatusChange("confirmation-required"));

    expect(
      screen.getByRole("complementary", { name: "준비 목록 항목" }),
    ).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("상태·카테고리·제목 편집은 동시에 열리지 않는다", () => {
    render(<EditableChecklistHarness />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "카테고리 변경, 현재 예식 준비",
      }),
    );
    expect(screen.getByRole("listbox", { name: "카테고리 선택" })).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "상태 변경, 현재 예정" }),
    );
    expect(screen.queryByRole("listbox", { name: "카테고리 선택" })).toBeNull();
    expect(screen.getByRole("listbox", { name: "상태 선택" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "할 일 제목 수정" }));
    expect(screen.queryByRole("listbox", { name: "상태 선택" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "할 일 제목" })).toBeTruthy();
  });

  it("카테고리 팝오버는 현재 값을 표시하고 키보드·바깥 클릭으로 닫은 뒤 포커스를 복원한다", async () => {
    const changeCategory = vi.fn().mockResolvedValue(true);
    render(<EditableChecklistHarness changeCategory={changeCategory} />);
    const trigger = screen.getByRole("button", {
      name: "카테고리 변경, 현재 예식 준비",
    });

    fireEvent.click(trigger);
    const currentOption = screen.getByRole("option", { name: "예식 준비" });
    const nextOption = screen.getByRole("option", { name: "예복 준비" });
    expect(currentOption.getAttribute("aria-selected")).toBe("true");
    expect(currentOption.getAttribute("tabindex")).toBe("0");
    expect(nextOption.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(currentOption);

    fireEvent.keyDown(currentOption, { key: "ArrowDown" });
    expect(document.activeElement).toBe(nextOption);
    expect(currentOption.getAttribute("tabindex")).toBe("-1");
    expect(nextOption.getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(nextOption, { key: "Escape" });

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("complementary")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(trigger));

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "예식 준비" }));
    expect(changeCategory).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(trigger));

    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("카테고리 팝오버는 아래 공간이 부족하면 viewport 안쪽 위로 배치한다", () => {
    vi.stubGlobal("innerWidth", 375);
    vi.stubGlobal("innerHeight", 768);
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function getBoundingClientRect(this: HTMLElement) {
        return this.classList.contains("checklist-category-editor__trigger")
          ? DOMRect.fromRect({ height: 32, width: 70, x: 280, y: 700 })
          : DOMRect.fromRect();
      });
    const scrollHeightSpy = vi
      .spyOn(HTMLElement.prototype, "scrollHeight", "get")
      .mockReturnValue(240);
    render(<EditableChecklistHarness />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "카테고리 변경, 현재 예식 준비",
      }),
    );

    const popover = document.querySelector(
      ".checklist-category-editor__popover",
    ) as HTMLDivElement;
    expect(popover.style.left).toBe("110px");
    expect(popover.style.maxHeight).toBe("682px");
    expect(popover.style.top).toBe("454px");
    expect(popover.style.width).toBe("240px");

    rectSpy.mockRestore();
    scrollHeightSpy.mockRestore();
  });

  it("새 카테고리를 한 번 저장하고 같은 상세 선택을 유지한 채 항목을 이동한다", async () => {
    let resolveChange: (value: boolean) => void = () => undefined;
    const changeCategory = vi.fn().mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveChange = resolve;
      }),
    );
    render(<EditableChecklistHarness changeCategory={changeCategory} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "카테고리 변경, 현재 예식 준비",
      }),
    );
    const nextOption = screen.getByRole("option", { name: "예복 준비" });
    fireEvent.click(nextOption);
    fireEvent.click(nextOption);

    expect(changeCategory).toHaveBeenCalledOnce();
    expect(changeCategory).toHaveBeenCalledWith(500, "20");
    expect(
      screen
        .getByRole("button", { name: "할 일 제목 수정" })
        .hasAttribute("disabled"),
    ).toBe(true);

    await act(async () => resolveChange(true));

    expect(
      screen.getByRole("complementary", { name: "청첩장 문구 정하기" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "카테고리 변경, 현재 예복 준비",
      }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "할 일 제목 수정" })
        .hasAttribute("disabled"),
    ).toBe(false);
    const movedCategoryList = document.getElementById("20-tasks");
    expect(movedCategoryList).toBeTruthy();
    expect(
      within(movedCategoryList as HTMLElement).getByRole("button", {
        hidden: true,
        name: /청첩장 문구 정하기/,
      }),
    ).toBeTruthy();
  });

  it("카테고리 저장 실패는 팝오버와 오류를 유지해 재시도할 수 있다", async () => {
    const changeCategory = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    render(<EditableChecklistHarness changeCategory={changeCategory} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "카테고리 변경, 현재 예식 준비",
      }),
    );
    const currentOption = screen.getByRole("option", { name: "예식 준비" });
    const nextOption = screen.getByRole("option", { name: "예복 준비" });

    act(() => nextOption.focus());
    fireEvent.click(nextOption);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "카테고리를 변경하지 못했습니다.",
    );
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(document.activeElement).toBe(nextOption);
    expect(nextOption.getAttribute("tabindex")).toBe("0");
    expect(nextOption.getAttribute("aria-selected")).toBe("false");
    expect(currentOption.getAttribute("tabindex")).toBe("-1");
    expect(currentOption.getAttribute("aria-selected")).toBe("true");

    fireEvent.click(nextOption);
    await waitFor(() => expect(changeCategory).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });

  it("breakpoint 전환 중에도 카테고리 팝오버 상태를 공유하고 요청하지 않는다", () => {
    const media = installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, false);
    const changeCategory = vi.fn().mockResolvedValue(true);
    render(<EditableChecklistHarness changeCategory={changeCategory} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "카테고리 변경, 현재 예식 준비",
      }),
    );
    expect(screen.getByRole("listbox")).toBeTruthy();

    act(() => media.setMatches(true));
    expect(
      screen.getByRole("dialog", { name: "청첩장 문구 정하기" }),
    ).toBeTruthy();
    expect(screen.getByRole("listbox")).toBeTruthy();

    act(() => media.setMatches(false));
    expect(
      screen.getByRole("complementary", { name: "청첩장 문구 정하기" }),
    ).toBeTruthy();
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(changeCategory).not.toHaveBeenCalled();
  });

  it("연필 버튼으로 제목을 선택한 인라인 입력을 열고 Enter로 trim한 제목을 한 번 저장한다", async () => {
    let resolveChange: (value: boolean) => void = () => undefined;
    const changeTitle = vi.fn().mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveChange = resolve;
      }),
    );
    render(<EditableChecklistHarness changeTitle={changeTitle} />);

    fireEvent.click(screen.getByRole("button", { name: "할 일 제목 수정" }));
    const input = screen.getByRole("textbox", { name: "할 일 제목" });
    expect(document.activeElement).toBe(input);
    expect((input as HTMLInputElement).selectionStart).toBe(0);
    expect((input as HTMLInputElement).selectionEnd).toBe(
      "청첩장 문구 정하기".length,
    );

    fireEvent.change(input, { target: { value: "  청첩장 문구 최종 확정  " } });
    fireEvent.keyDown(input, { isComposing: true, key: "Enter" });
    expect(changeTitle).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "할 일 제목 저장" }));

    expect(changeTitle).toHaveBeenCalledOnce();
    expect(changeTitle).toHaveBeenCalledWith(500, "청첩장 문구 최종 확정");

    await act(async () => resolveChange(true));
    expect(
      await screen.findByRole("heading", { name: "청첩장 문구 최종 확정" }),
    ).toBeTruthy();
  });

  it("빈 제목·50자 초과·동일 제목을 요청 전에 처리한다", async () => {
    const changeTitle = vi.fn().mockResolvedValue(true);
    render(<EditableChecklistHarness changeTitle={changeTitle} />);

    fireEvent.click(screen.getByRole("button", { name: "할 일 제목 수정" }));
    const input = screen.getByRole("textbox", { name: "할 일 제목" });

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "할 일 제목 저장" }));
    expect(screen.getByRole("alert").textContent).toContain("입력해주세요");

    fireEvent.change(input, { target: { value: "가".repeat(51) } });
    fireEvent.click(screen.getByRole("button", { name: "할 일 제목 저장" }));
    expect(screen.getByRole("alert").textContent).toContain("50자 이하");

    fireEvent.change(input, { target: { value: "  청첩장 문구 정하기  " } });
    fireEvent.click(screen.getByRole("button", { name: "할 일 제목 저장" }));

    expect(changeTitle).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "할 일 제목 수정" })).toBe(
        document.activeElement,
      ),
    );
  });

  it("제목 저장 실패는 draft와 오류를 유지하고 Escape는 편집만 취소한다", async () => {
    let resolveChange: (value: boolean) => void = () => undefined;
    const changeTitle = vi.fn().mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveChange = resolve;
      }),
    );
    render(<EditableChecklistHarness changeTitle={changeTitle} />);

    fireEvent.click(screen.getByRole("button", { name: "할 일 제목 수정" }));
    const input = screen.getByRole("textbox", { name: "할 일 제목" });
    fireEvent.change(input, { target: { value: "실패 후 유지할 제목" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await act(async () => resolveChange(false));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "제목을 변경하지 못했습니다.",
    );
    expect(
      (
        screen.getByRole("textbox", {
          name: "할 일 제목",
        }) as HTMLInputElement
      ).value,
    ).toBe("실패 후 유지할 제목");

    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.getByRole("complementary")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "할 일 제목" })).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "할 일 제목 수정" })).toBe(
        document.activeElement,
      ),
    );
  });

  it("모바일에서도 같은 공통 편집 컴포넌트를 사용하고 편집 Escape가 바텀시트를 닫지 않는다", () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    render(<EditableChecklistHarness />);

    const detailPage = screen.getByRole("dialog", {
      name: "청첩장 문구 정하기",
    });
    fireEvent.click(
      within(detailPage).getByRole("button", { name: "할 일 제목 수정" }),
    );
    const input = within(detailPage).getByRole("textbox", {
      name: "할 일 제목",
    });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(
      screen.getByRole("dialog", { name: "청첩장 문구 정하기" }),
    ).toBeTruthy();

    fireEvent.click(
      within(detailPage).getByRole("button", {
        name: "카테고리 변경, 현재 예식 준비",
      }),
    );
    fireEvent.keyDown(
      within(detailPage).getByRole("option", { name: "예식 준비" }),
      { key: "Escape" },
    );

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(
      screen.getByRole("dialog", { name: "청첩장 문구 정하기" }),
    ).toBeTruthy();

    fireEvent.click(
      within(detailPage).getByRole("button", {
        name: "상태 변경, 현재 예정",
      }),
    );
    fireEvent.keyDown(
      within(detailPage).getByRole("option", { name: "예정" }),
      { key: "Escape" },
    );

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(
      screen.getByRole("dialog", { name: "청첩장 문구 정하기" }),
    ).toBeTruthy();
  });
});
