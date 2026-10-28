import { StrictMode } from "react";
import { MemoryRouter } from "react-router";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthState } from "../auth/model/auth";
import type { ChecklistQueryModel } from "../checklist/model/checklistQuery";
import { installMatchMedia } from "../../test/matchMedia";
import { MOBILE_LAYOUT_MEDIA_QUERY } from "../../shared/responsive";

const mocks = vi.hoisted(() => ({
  auth: { status: "guest" } as AuthState,
  refreshAuth: vi.fn(),
  catalog: vi.fn(),
  getIds: vi.fn(),
  add: vi.fn(),
  getChecklist: vi.fn(),
  revision: 0,
  track: vi.fn(),
}));
vi.mock("../auth", () => ({
  useAuth: () => ({ authState: mocks.auth, refreshAuth: mocks.refreshAuth }),
}));
vi.mock("../../infrastructure/analytics", () => ({
  analytics: { track: mocks.track },
}));
vi.mock("./preparationDependencies", () => {
  const repository = {
    getCatalogItemIds: mocks.getIds,
    addCatalogItemIds: mocks.add,
  };
  return {
    usePreparationChecklistRepository: () => repository,
    preparationCatalogRepository: { getCatalog: mocks.catalog },
  };
});
vi.mock("../checklist/checklistQueryDependencies", () => {
  const repository = { getChecklist: mocks.getChecklist };
  return {
    useChecklistQueryRepository: () => repository,
    useChecklistRevision: () => mocks.revision,
  };
});
import { AllPreparationStepsFeature } from "./AllPreparationStepsFeature";
import { preparationCatalogFixture } from "./test/fixtures/preparationCatalog.fixture";
import {
  PreparationAuthenticationRequiredError,
  PreparationChecklistAdditionError,
} from "./repository/preparationErrors";
import { ChecklistQueryAuthenticationRequiredError } from "../checklist/repository/checklistQueryRepository";

let saved: ChecklistQueryModel;
let ids: string[];
function savedItem(id: number, status: "prev" | "done" = "prev") {
  return {
    id: `checklist-item-${id}`,
    checklistItemId: id,
    sourceCatalogItemId: id,
    categoryId: "wedding-hall",
    title: id === 101 ? "내 웨딩홀 투어" : "내 웨딩홀 견적 비교",
    status,
    appointments: [],
  };
}
function ui(categoryId?: string) {
  return (
    <MemoryRouter>
      <AllPreparationStepsFeature initialCategoryId={categoryId} />
    </MemoryRouter>
  );
}
async function show(categoryId?: string) {
  const result = render(ui(categoryId));
  await screen.findByRole("heading", { level: 1 });
  return result;
}
async function openFirst() {
  fireEvent.click(
    await screen.findByRole("button", { name: "01 웨딩홀 투어와 계약" }),
  );
  return screen.findByRole("dialog", { name: "01 웨딩홀 투어와 계약" });
}
const modal = () => screen.getByRole("dialog");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth = { status: "guest" };
  mocks.revision = 0;
  ids = ["101"];
  saved = {
    categories: [
      { id: "wedding-hall", title: "웨딩홀", items: [savedItem(101, "done")] },
    ],
  };
  mocks.catalog.mockReset().mockResolvedValue(preparationCatalogFixture);
  mocks.getIds.mockReset().mockImplementation(async () => [...ids]);
  mocks.getChecklist.mockReset().mockImplementation(async () => saved);
  mocks.add
    .mockReset()
    .mockImplementation(async (audience: string, requested: string[]) => {
      const added = requested.filter((id) => !ids.includes(id));
      ids.push(...added);
      if (audience === "authenticated") {
        saved = {
          categories: [
            {
              id: "wedding-hall",
              title: "웨딩홀",
              items: [
                ...saved.categories[0].items,
                ...added.map((id) => savedItem(Number(id))),
              ],
            },
          ],
        };
        mocks.revision += 1;
      }
      return added;
    });
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("단일 준비 로드맵", () => {
  it.each(["guest", "authenticated"] as const)(
    "%s도 같은 단계 전체와 카테고리를 보고 보기 전환은 제공하지 않는다",
    async (audience) => {
      if (audience === "authenticated")
        mocks.auth = {
          status: "authenticated",
          user: { id: 1, nickname: "비비디" },
        };
      await show();
      expect(
        within(screen.getByRole("list", { name: "준비 단계" })).getAllByRole(
          "button",
        ),
      ).toHaveLength(3);
      expect(screen.queryByRole("button", { name: "내 로드맵" })).toBeNull();
      expect(screen.queryByRole("button", { name: "전체 단계" })).toBeNull();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.queryByRole("checkbox")).toBeNull();
      expect(
        screen.getByRole("button", {
          name: "03 예식 진행자와 당일 도우미 섭외",
        }),
      ).toBeTruthy();
    },
  );
  it("초기 카테고리와 이후 URL 선택을 반영하며 카탈로그를 다시 요청하지 않는다", async () => {
    const { rerender } = await show("studio-dress-makeup");
    expect(screen.getByRole("heading", { name: "스드메" })).toBeTruthy();
    rerender(ui("wedding-hall"));
    expect(screen.getByRole("heading", { name: "웨딩홀" })).toBeTruthy();
    expect(mocks.catalog).toHaveBeenCalledOnce();
  });
  it("존재하지 않는 카테고리는 첫 단계가 있는 카테고리로 돌아간다", async () => {
    await show("unknown");
    expect(screen.getByRole("heading", { name: "웨딩홀" })).toBeTruthy();
  });
  it("카드를 선택하면 전체 할 일을 모달에 표시하고 닫으면 카드에 초점을 돌린다", async () => {
    await show();
    const trigger = screen.getByRole("button", {
      name: "01 웨딩홀 투어와 계약",
    });
    trigger.focus();
    const dialog = await openFirst();
    expect(
      within(dialog).getByText("웨딩홀을 둘러보고 계약해요."),
    ).toBeTruthy();
    expect(within(dialog).getByText("담은 일")).toBeTruthy();
    expect(
      within(dialog).getByRole("button", { name: "웨딩홀 견적 비교 추가" }),
    ).toBeTruthy();
    expect(within(dialog).queryByRole("link")).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "닫기" })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "확인" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
  it.each(["backdrop", "drag", "Escape"] as const)(
    "모바일은 닫기·관리 버튼 없이 단계 바텀시트를 열고 %s로 닫는다",
    async (dismiss) => {
      installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
      await show();
      const trigger = screen.getByRole("button", {
        name: "01 웨딩홀 투어와 계약",
      });
      trigger.focus();
      const dialog = await openFirst();
      expect(dialog.classList.contains("bibbidi-bottom-sheet")).toBe(true);
      expect(screen.queryByRole("dialog", { name: "보기 선택" })).toBeNull();
      expect(within(dialog).queryByRole("link")).toBeNull();
      expect(
        within(dialog).queryByRole("button", {
          name: /^(단계 상세 닫기|닫기|확인)$/,
        }),
      ).toBeNull();
      expect(
        dialog.querySelector(".bibbidi-bottom-sheet-header-actions"),
      ).toBeNull();
      expect(dialog.querySelector(".bibbidi-bottom-sheet-footer")).toBeNull();
      if (dismiss === "backdrop") {
        fireEvent.pointerDown(dialog, { isPrimary: true });
        fireEvent.pointerUp(dialog);
        fireEvent.click(dialog);
      } else if (dismiss === "drag") {
        const handle = within(dialog).getByRole("button", {
          name: "아래로 밀어 닫기",
        });
        const touch = (clientY: number) => ({
          identifier: 1,
          clientX: 100,
          clientY,
        });
        fireEvent.touchStart(handle, { touches: [touch(100)] });
        fireEvent.touchMove(handle, { touches: [touch(240)] });
        fireEvent.touchEnd(handle, {
          touches: [],
          changedTouches: [touch(240)],
        });
      } else {
        fireEvent.keyDown(dialog, { key: "Escape" });
      }
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    },
  );
  it("크기를 바꿔도 선택한 단계와 담은 일은 유지한다", async () => {
    const media = installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, false);
    await show();
    await openFirst();
    act(() => media.setMatches(true));
    const dialog = await screen.findByRole("dialog", {
      name: "01 웨딩홀 투어와 계약",
    });
    expect(dialog.classList.contains("bibbidi-bottom-sheet")).toBe(true);
    expect(within(dialog).getByText("담은 일")).toBeTruthy();
  });
  it.each([false, true])(
    "닫힘 전환 중 본문·레이어·잠금을 유지하고 완료 후 초점을 복귀한다: mobile=%s",
    async (mobile) => {
      const media = installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, mobile);
      await show();
      const trigger = screen.getByRole("button", {
        name: "01 웨딩홀 투어와 계약",
      });
      trigger.focus();
      const dialog = await openFirst();
      expect(
        within(dialog).getByRole("heading", {
          name: "01 웨딩홀 투어와 계약",
          level: 2,
        }),
      ).toBeTruthy();
      let finish!: () => void;
      const finished = new Promise<void>((resolve) => {
        finish = resolve;
      });
      Object.defineProperty(dialog.firstElementChild, "getAnimations", {
        value: () => [{ finished }],
      });
      if (mobile) {
        fireEvent.pointerDown(dialog, { isPrimary: true });
        fireEvent.pointerUp(dialog);
        fireEvent.click(dialog);
      } else
        fireEvent.click(within(dialog).getByRole("button", { name: "확인" }));
      expect(dialog.dataset.state).toBe("closing");
      expect((dialog as HTMLDialogElement).open).toBe(true);
      expect(
        within(dialog).getByText("웨딩홀을 둘러보고 계약해요."),
      ).toBeTruthy();
      expect(document.body.style.overflow).toBe("hidden");
      act(() => media.setMatches(!mobile));
      expect(screen.getByRole("dialog")).toBe(dialog);
      await act(async () => finish());
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(trigger));
      expect(document.body.style.overflow).not.toBe("hidden");
    },
  );
  it("로그인 상태는 내가 담은 일만 분모로 완료율을 표시한다", async () => {
    mocks.auth = {
      status: "authenticated",
      user: { id: 1, nickname: "비비디" },
    };
    await show();
    const progress = await screen.findByRole("progressbar", {
      name: "웨딩홀 투어와 계약 내 할 일 완료",
    });
    expect(progress.getAttribute("aria-valuenow")).toBe("100");
    expect(progress.getAttribute("aria-valuetext")).toBe("1개 중 1개 완료");
    expect(screen.getByText("내 할 일 완료")).toBeTruthy();
    expect(screen.getAllByText("준비 전")).toHaveLength(2);
  });
  it("게스트에게는 담은 개수만 표시하고 완료율을 만들지 않는다", async () => {
    await show();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(mocks.getChecklist).not.toHaveBeenCalled();
  });
  it("체크리스트 갱신으로 항목이 제거되면 준비 전으로 되돌린다", async () => {
    mocks.auth = {
      status: "authenticated",
      user: { id: 1, nickname: "비비디" },
    };
    const { rerender } = await show();
    await screen.findByText("내 할 일 완료");
    saved = { categories: [] };
    mocks.revision += 1;
    rerender(ui());
    await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
    expect(screen.getAllByText("준비 전")).toHaveLength(3);
  });
  it("내 현황 조회 실패에도 단계 탐색을 유지하고 다시 불러온다", async () => {
    mocks.auth = {
      status: "authenticated",
      user: { id: 1, nickname: "비비디" },
    };
    mocks.getChecklist.mockRejectedValueOnce(new Error("failed"));
    await show();
    await screen.findByText("내 준비 현황을 불러오지 못했어요.");
    expect(screen.getAllByText("현황 확인 필요")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "현황 다시 불러오기" }));
    await screen.findByText("내 할 일 완료");
  });
  it("현황 조회 인증 만료는 인증 갱신으로 연결한다", async () => {
    mocks.auth = {
      status: "authenticated",
      user: { id: 1, nickname: "비비디" },
    };
    mocks.getChecklist.mockRejectedValue(
      new ChecklistQueryAuthenticationRequiredError(),
    );
    await show();
    await waitFor(() => expect(mocks.refreshAuth).toHaveBeenCalled());
  });
  it.each(["guest", "authenticated"] as const)(
    "%s의 추가 성공은 같은 모달과 카드에 즉시 반영한다",
    async (audience) => {
      if (audience === "authenticated")
        mocks.auth = {
          status: "authenticated",
          user: { id: 1, nickname: "비비디" },
        };
      await show();
      const dialog = await openFirst();
      fireEvent.click(
        within(dialog).getByRole("button", { name: "웨딩홀 견적 비교 추가" }),
      );
      await waitFor(() =>
        expect(within(modal()).getAllByText(/^(담은 일|완료)$/)).toHaveLength(
          2,
        ),
      );
      expect(mocks.add).toHaveBeenCalledWith(
        audience,
        ["102"],
        expect.any(AbortSignal),
      );
      expect(
        within(modal()).queryByRole("button", { name: "모두 추가" }),
      ).toBeNull();
      expect(mocks.track).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "preparation_item_add",
          parameters: expect.objectContaining({ item_count: 1 }),
        }),
      );
    },
  );
  it("모두 추가는 아직 담지 않은 항목만 요청한다", async () => {
    await show();
    const dialog = await openFirst();
    fireEvent.click(within(dialog).getByRole("button", { name: "모두 추가" }));
    await waitFor(() =>
      expect(mocks.add).toHaveBeenCalledWith(
        "guest",
        ["102"],
        expect.any(AbortSignal),
      ),
    );
  });
  it.each([false, true])(
    "추가 버튼이 담은 상태로 바뀌면 다음 추가 버튼 또는 확인으로 초점을 옮긴다: %s",
    async (lastTask) => {
      ids = lastTask ? ["101"] : [];
      await show();
      await openFirst();
      const button = within(modal()).getByRole<HTMLButtonElement>("button", {
        name: lastTask ? "웨딩홀 견적 비교 추가" : "웨딩홀 투어 추가",
      });
      button.focus();
      fireEvent.click(button);
      await waitFor(() =>
        expect(document.activeElement).toBe(
          within(modal()).getByRole("button", {
            name: lastTask ? "확인" : "웨딩홀 견적 비교 추가",
          }),
        ),
      );
    },
  );

  it("모바일에서 마지막 할 일을 추가하면 바텀시트로 초점을 옮긴다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    await show();
    const dialog = await openFirst();
    const button = within(dialog).getByRole("button", {
      name: "웨딩홀 견적 비교 추가",
    });
    button.focus();
    fireEvent.click(button);
    await waitFor(() => {
      expect(within(dialog).getAllByText("담은 일")).toHaveLength(2);
      expect(document.activeElement).toBe(dialog);
    });
  });

  it("전체 추가의 일부만 저장되면 실제로 저장된 항목만 담은 상태로 표시한다", async () => {
    ids = [];
    mocks.add.mockResolvedValue(["102"]);
    await show();
    await openFirst();
    fireEvent.click(within(modal()).getByRole("button", { name: "모두 추가" }));
    await waitFor(() =>
      expect(within(modal()).getAllByText("담은 일")).toHaveLength(1),
    );
    expect(
      within(modal()).getByRole("button", { name: "웨딩홀 투어 추가" }),
    ).toBeTruthy();
    expect(
      within(modal()).queryByRole("button", { name: "웨딩홀 견적 비교 추가" }),
    ).toBeNull();
  });

  it("추가 중에는 중복 실행과 닫기를 막는다", async () => {
    let finish!: (ids: string[]) => void;
    mocks.add.mockImplementation(
      () =>
        new Promise<string[]>((resolve) => {
          finish = resolve;
        }),
    );
    await show();
    const dialog = await openFirst();
    const button = within(dialog).getByRole("button", {
      name: "웨딩홀 견적 비교 추가",
    });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.add).toHaveBeenCalledOnce();
    expect(
      within(dialog).getByRole<HTMLButtonElement>("button", { name: "확인" })
        .disabled,
    ).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBe(dialog);
    await act(async () => finish(["102"]));
    expect(
      within(modal()).getByRole<HTMLButtonElement>("button", { name: "확인" })
        .disabled,
    ).toBe(false);
  });
  it("추가 실패는 모달에 남겨 재시도할 수 있다", async () => {
    mocks.add.mockRejectedValueOnce(
      new PreparationChecklistAdditionError("저장 실패"),
    );
    await show();
    await openFirst();
    fireEvent.click(
      within(modal()).getByRole("button", { name: "웨딩홀 견적 비교 추가" }),
    );
    await within(modal()).findByRole("alert");
    fireEvent.click(
      within(modal()).getByRole("button", { name: "웨딩홀 견적 비교 추가" }),
    );
    await waitFor(() =>
      expect(within(modal()).queryByRole("alert")).toBeNull(),
    );
    expect(mocks.add).toHaveBeenCalledTimes(2);
  });
  it("서버가 실제 추가한 항목이 없으면 추가 이벤트를 만들지 않는다", async () => {
    mocks.add.mockResolvedValue([]);
    await show();
    await openFirst();
    mocks.track.mockClear();
    fireEvent.click(within(modal()).getByRole("button", { name: "모두 추가" }));
    await waitFor(() =>
      expect(
        within(modal()).getByRole<HTMLButtonElement>("button", {
          name: "모두 추가",
        }).disabled,
      ).toBe(false),
    );
    expect(mocks.track).not.toHaveBeenCalled();
  });
  it("추가 요청 인증 만료를 갱신하고 원래 모달에서 안내한다", async () => {
    mocks.add.mockRejectedValue(new PreparationAuthenticationRequiredError());
    await show();
    await openFirst();
    fireEvent.click(within(modal()).getByRole("button", { name: "모두 추가" }));
    await within(modal()).findByRole("alert");
    expect(mocks.refreshAuth).toHaveBeenCalled();
  });
  it("계정이 바뀌면 이전 진행 상태를 즉시 숨기고 저장 요청을 취소한다", async () => {
    mocks.auth = { status: "authenticated", user: { id: 1, nickname: "A" } };
    let signal!: AbortSignal;
    mocks.add.mockImplementation((_audience, _ids, s) => {
      signal = s;
      return new Promise(() => {});
    });
    const { rerender } = await show();
    await openFirst();
    fireEvent.click(within(modal()).getByRole("button", { name: "모두 추가" }));
    mocks.auth = { status: "authenticated", user: { id: 2, nickname: "B" } };
    saved = { categories: [] };
    ids = [];
    rerender(ui());
    expect(signal.aborted).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
    await screen.findByRole("heading", { name: "웨딩홀" });
    expect(screen.queryByText("내 할 일 완료")).toBeNull();
  });
  it("조회 실패는 재시도하고 단계가 없으면 빈 상태를 표시한다", async () => {
    mocks.catalog.mockRejectedValueOnce(new Error("failed"));
    render(ui());
    await screen.findByRole("alert");
    mocks.catalog.mockResolvedValue({
      ...preparationCatalogFixture,
      roadmaps: [],
    });
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByText("표시할 로드맵이 없어요.");
  });
  it("화면을 떠나면 카탈로그 조회를 취소한다", () => {
    let signal!: AbortSignal;
    mocks.catalog.mockImplementation((s) => {
      signal = s;
      return new Promise(() => {});
    });
    const { unmount } = render(ui());
    unmount();
    expect(signal.aborted).toBe(true);
  });
  it("StrictMode 최초 진입은 한 번 기록하고 카테고리·단계 선택을 기록한다", async () => {
    render(<StrictMode>{ui()}</StrictMode>);
    await screen.findByRole("heading", { name: "웨딩홀" });
    expect(
      mocks.track.mock.calls.filter(
        ([e]) => e.name === "preparation_catalog_view",
      ),
    ).toHaveLength(1);
    await openFirst();
    expect(mocks.track).toHaveBeenCalledWith(
      expect.objectContaining({ name: "preparation_step_select" }),
    );
    fireEvent.click(within(modal()).getByRole("button", { name: "확인" }));
    fireEvent.click(screen.getByRole("tab", { name: "스드메" }));
    expect(mocks.track).toHaveBeenCalledWith(
      expect.objectContaining({ name: "preparation_category_select" }),
    );
  });
});
