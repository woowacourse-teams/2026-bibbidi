import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useSyncExternalStore } from "react";
import type { ComponentProps } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOBILE_LAYOUT_MEDIA_QUERY } from "../../shared/responsive";
import { installMatchMedia } from "../../test/matchMedia";

const authMocks = vi.hoisted(() => ({
  authState: { status: "guest" } as
    | { status: "authenticated"; user: { nickname: string } }
    | { status: "error" }
    | { status: "guest" }
    | { status: "loading" }
    | { status: "synchronizing"; user: { nickname: string } },
  refreshAuth: vi.fn(),
}));
const repositoryMocks = vi.hoisted(() => {
  const changeItemCategory = vi.fn();
  const changeItemStatus = vi.fn();
  const changeItemTitle = vi.fn();
  const createCustomItem = vi.fn();
  const getChecklist = vi.fn();
  const hasRemainingAppointments = vi.fn();
  const cacheGetChecklist = vi.fn();
  const cacheInvalidate = vi.fn();
  const revisionListeners = new Set<() => void>();

  return {
    changeItemCategory,
    changeItemStatus,
    changeItemTitle,
    createCustomItem,
    checklistRevision: 0,
    publishRevision() {
      this.checklistRevision += 1;
      for (const listener of revisionListeners) listener();
    },
    revisionListeners,
    command: {
      changeItemCategory,
      changeItemStatus,
      changeItemTitle,
      createCustomItem,
      ensureChecklist: vi.fn(),
      hasRemainingAppointments,
      createAppointment: vi.fn(),
      reconcileMissingChecklist: vi.fn(),
    },
    cache: { getChecklist: cacheGetChecklist, invalidate: cacheInvalidate },
    cacheGetChecklist,
    cacheInvalidate,
    current: { getChecklist },
    getChecklist,
    hasRemainingAppointments,
  };
});

vi.mock("../auth", () => ({
  useAuth: () => ({
    authState: authMocks.authState,
    refreshAuth: authMocks.refreshAuth,
  }),
}));
vi.mock("./checklistQueryDependencies", () => ({
  useChecklistCommandRepository: () => repositoryMocks.command,
  useChecklistCacheRepository: () => repositoryMocks.cache,
  useChecklistQueryRepository: () => repositoryMocks.current,
  useChecklistRevision: () =>
    useSyncExternalStore(
      (listener) => {
        repositoryMocks.revisionListeners.add(listener);
        return () => repositoryMocks.revisionListeners.delete(listener);
      },
      () => repositoryMocks.checklistRevision,
    ),
}));

import { ChecklistFeature } from "./ChecklistFeature";
import { ChecklistQueryModel } from "./model/checklistQuery";
import {
  ChecklistQueryAuthenticationRequiredError,
  ChecklistQueryLoadError,
  ChecklistQueryRequestAbortedError,
} from "./repository/checklistQueryRepository";
import {
  ChecklistItemChangeError,
  CustomChecklistItemCreationError,
} from "./repository/myChecklistCommandRepository";
import {
  MyChecklistAuthenticationRequiredError,
  MyChecklistLoadError,
} from "./repository/myChecklistQueryRepository";
import { ChecklistAppointmentCreationInput } from "./useChecklistAppointmentCreation";

function createChecklist(title = "로컬 체크리스트 항목"): ChecklistQueryModel {
  return {
    categories: [
      { id: "20", items: [], title: "두 번째 카테고리" },
      {
        id: "10",
        items: [
          {
            appointments: [],
            categoryId: "10",
            checklistItemId: null,
            id: "catalog-item-101",
            sourceCatalogItemId: 101,
            status: "prev",
            title,
          },
        ],
        title: "첫 번째 카테고리",
      },
    ],
  };
}

function createAuthenticatedChecklist(): ChecklistQueryModel {
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
        ],
        title: "예식 준비",
      },
      { id: "20", items: [], title: "예복 준비" },
    ],
  };
}

function RouterControls() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <div data-testid="current-url">
        {`${location.pathname}${location.search}`}
      </div>
      <button onClick={() => navigate(-1)} type="button">
        브라우저 뒤로가기
      </button>
    </>
  );
}

function ChecklistFeatureTestApp({
  initialEntries = ["/checklist"],
  onSubmitAppointment,
}: {
  initialEntries?: ComponentProps<typeof MemoryRouter>["initialEntries"];
  onSubmitAppointment?: (
    input: ChecklistAppointmentCreationInput,
    signal: AbortSignal,
  ) => Promise<boolean | void> | boolean | void;
}) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <ChecklistFeature onSubmitAppointment={onSubmitAppointment} />
      <RouterControls />
    </MemoryRouter>
  );
}

function renderChecklistFeature(
  initialEntries?: ComponentProps<typeof MemoryRouter>["initialEntries"],
  onSubmitAppointment?: (
    input: ChecklistAppointmentCreationInput,
    signal: AbortSignal,
  ) => Promise<boolean | void> | boolean | void,
) {
  return render(
    <ChecklistFeatureTestApp
      initialEntries={initialEntries}
      onSubmitAppointment={onSubmitAppointment}
    />,
  );
}

function getCurrentUrl() {
  return screen.getByTestId("current-url").textContent;
}

beforeEach(() => {
  authMocks.authState = { status: "guest" };
  authMocks.refreshAuth.mockReset();
  repositoryMocks.changeItemCategory.mockReset();
  repositoryMocks.changeItemCategory.mockResolvedValue(undefined);
  repositoryMocks.changeItemStatus.mockReset();
  repositoryMocks.changeItemStatus.mockResolvedValue(undefined);
  repositoryMocks.changeItemTitle.mockReset();
  repositoryMocks.changeItemTitle.mockResolvedValue(undefined);
  repositoryMocks.createCustomItem.mockReset();
  repositoryMocks.createCustomItem.mockResolvedValue(undefined);
  repositoryMocks.command.createAppointment.mockReset();
  repositoryMocks.command.createAppointment.mockResolvedValue(undefined);
  repositoryMocks.cacheGetChecklist.mockReset();
  repositoryMocks.cacheGetChecklist.mockResolvedValue({
    exists: true,
    items: [],
  });
  repositoryMocks.cacheInvalidate.mockReset();
  repositoryMocks.checklistRevision = 0;
  repositoryMocks.getChecklist.mockReset();
  repositoryMocks.getChecklist.mockResolvedValue(createChecklist());
  repositoryMocks.hasRemainingAppointments.mockReset();
  repositoryMocks.hasRemainingAppointments.mockResolvedValue(false);
  repositoryMocks.current = { getChecklist: repositoryMocks.getChecklist };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChecklistFeature 인증 상태별 조회", () => {
  it("인증 확인 중에는 접근 가능한 로딩 상태를 표시하고 조회하지 않는다", () => {
    authMocks.authState = { status: "loading" };

    renderChecklistFeature();

    expect(screen.getByRole("status").textContent).toBe(
      "체크리스트를 불러오고 있어요.",
    );
    expect(repositoryMocks.getChecklist).not.toHaveBeenCalled();
  });

  it("synchronizing 중에는 이전 guest 결과를 숨기고 새로 조회하지 않는다", async () => {
    const view = renderChecklistFeature();
    expect(await screen.findByText("로컬 체크리스트 항목")).toBeTruthy();

    authMocks.authState = {
      status: "synchronizing",
      user: { nickname: "bibbidi" },
    };
    view.rerender(<ChecklistFeatureTestApp />);

    expect(screen.queryByText("로컬 체크리스트 항목")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      "체크리스트를 불러오고 있어요.",
    );
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
  });

  it("비로그인 audience의 Local Storage 조합 결과를 표시한다", async () => {
    renderChecklistFeature();

    expect(await screen.findByText("로컬 체크리스트 항목")).toBeTruthy();
    expect(repositoryMocks.getChecklist).toHaveBeenCalledWith(
      "guest",
      expect.any(AbortSignal),
    );
  });

  it("비로그인 상태에서는 서버 항목 형태가 들어와도 제목 편집을 노출하지 않는다", async () => {
    repositoryMocks.getChecklist.mockResolvedValue(
      createAuthenticatedChecklist(),
    );
    renderChecklistFeature(["/checklist?taskId=checklist-item-500"]);

    expect(
      await screen.findByRole("complementary", {
        name: "청첩장 문구 정하기",
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "할 일 제목 수정" }),
    ).toBeNull();
  });

  it("로그인 audience의 서버 항목과 직접 작성 항목을 서버 순서로 표시한다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockResolvedValue({
      categories: [
        {
          id: "10",
          items: [
            {
              appointments: [],
              categoryId: "10",
              checklistItemId: 10,
              id: "checklist-item-10",
              sourceCatalogItemId: 101,
              status: "prev",
              title: "서버 Catalog 항목",
            },
            {
              appointments: [],
              categoryId: "10",
              checklistItemId: 11,
              id: "checklist-item-11",
              sourceCatalogItemId: null,
              status: "prev",
              title: "직접 작성 항목",
            },
          ],
          title: "첫 번째 카테고리",
        },
      ],
    });

    renderChecklistFeature();

    await screen.findByText("직접 작성 항목");
    expect(
      screen
        .getAllByRole("listitem")
        .map((item) => within(item).getByText(/항목$/).textContent),
    ).toEqual(["서버 Catalog 항목", "직접 작성 항목"]);
    expect(repositoryMocks.getChecklist).toHaveBeenCalledWith(
      "authenticated",
      expect.any(AbortSignal),
    );
  });

  it("단순 리렌더링으로 조회를 반복하지 않는다", async () => {
    const view = renderChecklistFeature();
    await screen.findByText("로컬 체크리스트 항목");

    view.rerender(<ChecklistFeatureTestApp />);

    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
  });

  it("할 일 상세 패널을 열어도 체크리스트를 다시 조회하지 않는다", async () => {
    renderChecklistFeature();

    fireEvent.click(
      await screen.findByRole("button", { name: /로컬 체크리스트 항목/ }),
    );

    expect(
      screen.getByRole("complementary", { name: "로컬 체크리스트 항목" }),
    ).toBeTruthy();
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
  });

  it("비로그인 사용자에게 CTA와 로그인 안내를 제공하고 기존 로그인 경로로 이동한다", async () => {
    renderChecklistFeature();
    const addTaskButton = await screen.findByRole("button", {
      name: "할 일 추가",
    });

    fireEvent.click(addTaskButton);
    let dialog = screen.getByRole("dialog", { name: "로그인이 필요해요" });
    const background = document.querySelector(".checklist-workspace__main");
    expect(background?.hasAttribute("inert")).toBe(true);
    expect(background?.getAttribute("aria-hidden")).toBe("true");
    expect(
      within(dialog).getByText(/나만의 할 일을 추가하려면 로그인해 주세요/),
    ).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "취소" })).toBe(
      document.activeElement,
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(
      screen.queryByRole("dialog", { name: "로그인이 필요해요" }),
    ).toBeNull();
    expect(background?.hasAttribute("inert")).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(addTaskButton));

    fireEvent.click(addTaskButton);
    dialog = screen.getByRole("dialog", { name: "로그인이 필요해요" });
    fireEvent.click(within(dialog).getByRole("button", { name: "로그인" }));

    expect(getCurrentUrl()).toBe("/login");
  });

  it("로그인 안내가 열리면 상세 패널을 포함한 배경 전체를 비활성화한다", async () => {
    renderChecklistFeature();
    fireEvent.click(
      await screen.findByRole("button", { name: /로컬 체크리스트 항목/ }),
    );
    const detailPanel = screen.getByRole("complementary", {
      name: "로컬 체크리스트 항목",
    });
    const foreground = detailPanel.closest(".checklist-workspace__foreground");

    fireEvent.click(screen.getByRole("button", { name: "할 일 추가" }));

    expect(
      screen.getByRole("dialog", { name: "로그인이 필요해요" }),
    ).toBeTruthy();
    expect(foreground?.hasAttribute("inert")).toBe(true);
    expect(foreground?.getAttribute("aria-hidden")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(foreground?.hasAttribute("inert")).toBe(false);
    expect(
      screen.getByRole("complementary", { name: "로컬 체크리스트 항목" }),
    ).toBe(detailPanel);
  });

  it("비로그인 데스크톱 상세에서 일정 추가 의도를 로그인 안내로 제한한다", async () => {
    renderChecklistFeature();
    fireEvent.click(
      await screen.findByRole("button", { name: /로컬 체크리스트 항목/ }),
    );
    const detailPanel = screen.getByRole("complementary", {
      name: "로컬 체크리스트 항목",
    });
    const addScheduleButton = within(detailPanel).getByRole("button", {
      name: "일정 추가",
    });

    fireEvent.click(addScheduleButton);

    let dialog = screen.getByRole("dialog", { name: "로그인이 필요해요" });
    const main = document.querySelector(".checklist-workspace__main");
    const foreground = detailPanel.closest(".checklist-workspace__foreground");
    expect(
      within(dialog).getByText(/일정을 추가하려면 로그인해 주세요/),
    ).toBeTruthy();
    expect(within(dialog).queryByText(/나만의 할 일을 추가하려면/)).toBeNull();
    expect(getCurrentUrl()).toBe("/checklist?taskId=catalog-item-101");
    expect(main?.hasAttribute("inert")).toBe(true);
    expect(main?.getAttribute("aria-hidden")).toBe("true");
    expect(foreground?.hasAttribute("inert")).toBe(true);
    expect(foreground?.getAttribute("aria-hidden")).toBe("true");
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
    expect(repositoryMocks.createCustomItem).not.toHaveBeenCalled();
    expect(repositoryMocks.changeItemCategory).not.toHaveBeenCalled();
    expect(repositoryMocks.changeItemStatus).not.toHaveBeenCalled();
    expect(repositoryMocks.changeItemTitle).not.toHaveBeenCalled();
    expect(repositoryMocks.hasRemainingAppointments).not.toHaveBeenCalled();

    const cancelButton = within(dialog).getByRole("button", { name: "취소" });
    const loginButton = within(dialog).getByRole("button", { name: "로그인" });
    expect(document.activeElement).toBe(cancelButton);
    loginButton.focus();
    fireEvent.keyDown(loginButton, { key: "Tab" });
    expect(document.activeElement).toBe(cancelButton);
    fireEvent.keyDown(cancelButton, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(loginButton);

    fireEvent.click(cancelButton);
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(addScheduleButton));
    expect(main?.hasAttribute("inert")).toBe(false);
    expect(foreground?.hasAttribute("inert")).toBe(false);

    fireEvent.click(addScheduleButton);
    dialog = screen.getByRole("dialog", { name: "로그인이 필요해요" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByRole("complementary", { name: "로컬 체크리스트 항목" }),
    ).toBe(detailPanel);
    await waitFor(() => expect(document.activeElement).toBe(addScheduleButton));

    fireEvent.click(addScheduleButton);
    const backdrop = document.querySelector<HTMLElement>(
      ".checklist-dialog__backdrop",
    );
    expect(backdrop).not.toBeNull();
    if (backdrop) {
      fireEvent.mouseDown(backdrop);
    }
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(addScheduleButton));

    fireEvent.click(addScheduleButton);
    dialog = screen.getByRole("dialog", { name: "로그인이 필요해요" });
    fireEvent.click(within(dialog).getByRole("button", { name: "로그인" }));
    expect(getCurrentUrl()).toBe("/login");
  });

  it("비로그인 모바일 상세에서도 일정 추가 안내와 초점 복원을 제공한다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    renderChecklistFeature();
    fireEvent.click(
      await screen.findByRole("button", { name: /로컬 체크리스트 항목/ }),
    );
    const detailPage = screen.getByRole("region", {
      name: "로컬 체크리스트 항목",
    });
    const addScheduleButton = within(detailPage).getByRole("button", {
      name: "일정 추가",
    });

    fireEvent.click(addScheduleButton);

    const dialog = screen.getByRole("dialog", { name: "로그인이 필요해요" });
    const foreground = detailPage.closest(".checklist-workspace__foreground");
    expect(
      within(dialog).getByText(/일정을 추가하려면 로그인해 주세요/),
    ).toBeTruthy();
    expect(foreground?.hasAttribute("inert")).toBe(true);
    expect(foreground?.getAttribute("aria-hidden")).toBe("true");
    expect(getCurrentUrl()).toBe("/checklist?taskId=catalog-item-101");

    fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("region", { name: "로컬 체크리스트 항목" })).toBe(
      detailPage,
    );
    await waitFor(() => expect(document.activeElement).toBe(addScheduleButton));
    expect(foreground?.hasAttribute("inert")).toBe(false);
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
    expect(repositoryMocks.createCustomItem).not.toHaveBeenCalled();
  });

  it("로그인 사용자는 같은 일정 추가 진입점에서 데스크톱 입력 패널을 연다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockResolvedValue(
      createAuthenticatedChecklist(),
    );
    renderChecklistFeature(["/checklist?taskId=checklist-item-500"]);

    const detailPanel = await screen.findByRole("complementary", {
      name: "청첩장 문구 정하기",
    });
    fireEvent.click(
      within(detailPanel).getByRole("button", { name: "일정 추가" }),
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    const creationPanel = screen.getByRole("complementary", {
      name: "일정 추가",
    });
    expect(within(creationPanel).getByRole("textbox", { name: /제목/ })).toBe(
      document.activeElement,
    );
    expect(within(creationPanel).getByText("청첩장 문구 정하기")).toBeTruthy();
    expect(
      within(creationPanel).queryByText("일정 저장 기능은 준비 중이에요."),
    ).toBeNull();
    expect(
      (
        within(creationPanel).getByRole("button", {
          name: "저장",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(getCurrentUrl()).toBe("/checklist?taskId=checklist-item-500");
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
    expect(repositoryMocks.createCustomItem).not.toHaveBeenCalled();
    expect(repositoryMocks.changeItemCategory).not.toHaveBeenCalled();
    expect(repositoryMocks.changeItemStatus).not.toHaveBeenCalled();
    expect(repositoryMocks.changeItemTitle).not.toHaveBeenCalled();
    expect(repositoryMocks.hasRemainingAppointments).not.toHaveBeenCalled();
  });

  it("검증을 통과한 일정 값을 로컬 날짜·시간 문자열로 submit 경계에 전달한다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockResolvedValue(
      createAuthenticatedChecklist(),
    );
    const onSubmitAppointment = vi.fn().mockResolvedValue(true);
    renderChecklistFeature(
      ["/checklist?taskId=checklist-item-500"],
      onSubmitAppointment,
    );

    const detailPanel = await screen.findByRole("complementary", {
      name: "청첩장 문구 정하기",
    });
    const addScheduleButton = within(detailPanel).getByRole("button", {
      name: "일정 추가",
    });
    fireEvent.click(addScheduleButton);

    const creationPanel = screen.getByRole("complementary", {
      name: "일정 추가",
    });
    fireEvent.change(within(creationPanel).getByLabelText(/제목/), {
      target: { value: " 웨딩홀 상담 " },
    });
    fireEvent.change(within(creationPanel).getByLabelText(/날짜/), {
      target: { value: "2026-09-01" },
    });
    fireEvent.change(within(creationPanel).getByLabelText("시작 시간"), {
      target: { value: "10:00" },
    });
    fireEvent.change(within(creationPanel).getByLabelText("종료 시간"), {
      target: { value: "11:30" },
    });
    fireEvent.change(within(creationPanel).getByLabelText(/장소/), {
      target: { value: " 웨딩홀 " },
    });
    fireEvent.change(within(creationPanel).getByLabelText("메모"), {
      target: { value: " 견적서 지참 " },
    });
    fireEvent.click(
      within(creationPanel).getByRole("button", { name: "저장" }),
    );

    await waitFor(() =>
      expect(onSubmitAppointment).toHaveBeenCalledWith(
        {
          checklistItemId: 500,
          date: "2026-09-01",
          endTime: "2026-09-01T11:30:00",
          memo: "견적서 지참",
          place: "웨딩홀",
          startTime: "2026-09-01T10:00:00",
          title: "웨딩홀 상담",
        },
        expect.any(AbortSignal),
      ),
    );
    expect(
      screen.queryByRole("complementary", { name: "일정 추가" }),
    ).toBeNull();
    const restoredDetail = screen.getByRole("complementary", {
      name: "청첩장 문구 정하기",
    });
    await waitFor(() =>
      expect(
        within(restoredDetail).getByRole("button", { name: "일정 추가" }),
      ).toBe(document.activeElement),
    );
    expect(repositoryMocks.createCustomItem).not.toHaveBeenCalled();
  });

  it("생성 성공 후 기존 체크리스트 revision으로 상세 목록과 대표 날짜를 갱신한다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockResolvedValue(
      createAuthenticatedChecklist(),
    );
    repositoryMocks.cacheGetChecklist.mockImplementation(async () => {
      const updated = createAuthenticatedChecklist();
      updated.categories[0].items[0].appointments.push({
        id: 77,
        title: "웨딩홀 상담",
        date: "2026-09-20",
        startTime: null,
        endTime: null,
        place: null,
        memo: null,
        isDone: false,
      });
      repositoryMocks.getChecklist.mockResolvedValue(updated);
      repositoryMocks.publishRevision();
      return { exists: true, items: [] };
    });
    renderChecklistFeature(["/checklist?taskId=checklist-item-500"]);
    const detail = await screen.findByRole("complementary", {
      name: "청첩장 문구 정하기",
    });
    fireEvent.click(within(detail).getByRole("button", { name: "일정 추가" }));
    const form = screen.getByRole("complementary", { name: "일정 추가" });
    fireEvent.change(within(form).getByLabelText(/제목/), {
      target: { value: "웨딩홀 상담" },
    });
    fireEvent.change(within(form).getByLabelText(/날짜/), {
      target: { value: "2026-09-20" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("complementary", { name: "일정 추가" }),
      ).toBeNull(),
    );
    await screen.findByText("웨딩홀 상담");
    const updatedDetail = screen.getByRole("complementary", {
      name: "청첩장 문구 정하기",
    });
    expect(within(updatedDetail).getByText("일정 1개")).toBeTruthy();
    expect(
      document.querySelector(".checklist__task-schedule")?.textContent,
    ).toBe("9월 20일");
    await waitFor(() =>
      expect(
        within(updatedDetail).getByRole("button", { name: "일정 추가" }),
      ).toBe(document.activeElement),
    );
    expect(repositoryMocks.command.createAppointment).toHaveBeenCalledWith(
      500,
      {
        title: "웨딩홀 상담",
        date: "2026-09-20",
        startTime: null,
        endTime: null,
        place: null,
        memo: null,
      },
      expect.any(AbortSignal),
    );
    expect(repositoryMocks.getChecklist).toHaveBeenCalledTimes(2);
    expect(repositoryMocks.cacheInvalidate).toHaveBeenCalledOnce();
    expect(repositoryMocks.cacheGetChecklist).toHaveBeenCalledOnce();
  });

  it("401은 refreshAuth로 연결하고 내부 메시지를 입력 UI에 표시하지 않는다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockResolvedValue(
      createAuthenticatedChecklist(),
    );
    repositoryMocks.command.createAppointment.mockRejectedValue(
      new MyChecklistAuthenticationRequiredError(),
    );
    renderChecklistFeature(["/checklist?taskId=checklist-item-500"]);
    fireEvent.click(await screen.findByRole("button", { name: "일정 추가" }));
    const form = screen.getByRole("complementary", { name: "일정 추가" });
    fireEvent.change(within(form).getByLabelText(/제목/), {
      target: { value: "상담" },
    });
    fireEvent.change(within(form).getByLabelText(/날짜/), {
      target: { value: "2026-09-20" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "저장" }));
    await waitFor(() => expect(authMocks.refreshAuth).toHaveBeenCalledOnce());
    expect(within(form).getByRole("alert").textContent).toBe(
      "일정을 저장하지 못했어요. 다시 시도해 주세요.",
    );
  });

  it("생성 후 체크리스트 재조회에서 401이면 인증을 갱신하고 POST를 반복하지 않는다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockResolvedValue(
      createAuthenticatedChecklist(),
    );
    repositoryMocks.cacheGetChecklist.mockRejectedValue(
      new MyChecklistAuthenticationRequiredError(),
    );
    renderChecklistFeature(["/checklist?taskId=checklist-item-500"]);
    fireEvent.click(await screen.findByRole("button", { name: "일정 추가" }));
    const form = screen.getByRole("complementary", { name: "일정 추가" });
    fireEvent.change(within(form).getByLabelText(/제목/), {
      target: { value: "상담" },
    });
    fireEvent.change(within(form).getByLabelText(/날짜/), {
      target: { value: "2026-09-20" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "저장" }));
    await waitFor(() => expect(authMocks.refreshAuth).toHaveBeenCalledOnce());
    expect(within(form).getByRole("alert").textContent).toBe(
      "일정은 저장됐어요. 목록을 다시 불러와 주세요.",
    );
    expect(repositoryMocks.command.createAppointment).toHaveBeenCalledOnce();
  });

  it("생성 후 조회만 실패하면 입력을 유지하고 재시도에서 POST를 반복하지 않는다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockResolvedValue(
      createAuthenticatedChecklist(),
    );
    repositoryMocks.cacheGetChecklist
      .mockRejectedValueOnce(new MyChecklistLoadError())
      .mockImplementation(async () => {
        repositoryMocks.publishRevision();
        return { exists: true, items: [] };
      });
    renderChecklistFeature(["/checklist?taskId=checklist-item-500"]);
    fireEvent.click(await screen.findByRole("button", { name: "일정 추가" }));
    const form = screen.getByRole("complementary", { name: "일정 추가" });
    const titleInput = within(form).getByLabelText(/제목/) as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "상담" } });
    fireEvent.change(within(form).getByLabelText(/날짜/), {
      target: { value: "2026-09-20" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "저장" }));
    await within(form).findByText(
      "일정은 저장됐어요. 목록을 다시 불러와 주세요.",
    );
    expect(titleInput.value).toBe("상담");
    fireEvent.click(
      within(form).getByRole("button", { name: "목록 다시 불러오기" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("complementary", { name: "일정 추가" }),
      ).toBeNull(),
    );
    expect(repositoryMocks.command.createAppointment).toHaveBeenCalledOnce();
    expect(repositoryMocks.cacheGetChecklist).toHaveBeenCalledTimes(2);
    expect(repositoryMocks.cacheInvalidate).toHaveBeenCalledTimes(2);
  });

  it("일정 입력 오류를 각 필드에 연결하고 첫 오류 입력으로 초점을 이동한다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockResolvedValue(
      createAuthenticatedChecklist(),
    );
    renderChecklistFeature(["/checklist?taskId=checklist-item-500"], vi.fn());

    const detailPanel = await screen.findByRole("complementary", {
      name: "청첩장 문구 정하기",
    });
    fireEvent.click(
      within(detailPanel).getByRole("button", { name: "일정 추가" }),
    );
    const creationPanel = screen.getByRole("complementary", {
      name: "일정 추가",
    });
    const titleInput = within(creationPanel).getByRole("textbox", {
      name: /제목/,
    });
    const dateInput = within(creationPanel).getByLabelText(/날짜/);
    fireEvent.click(
      within(creationPanel).getByRole("button", { name: "저장" }),
    );

    const titleError =
      within(creationPanel).getByText("일정 제목을 입력해 주세요.");
    const dateError = within(creationPanel).getByText("날짜를 선택해 주세요.");
    expect(titleInput.getAttribute("aria-invalid")).toBe("true");
    expect(titleInput.getAttribute("aria-describedby")).toBe(titleError.id);
    expect(dateInput.getAttribute("aria-invalid")).toBe("true");
    expect(dateInput.getAttribute("aria-describedby")).toBe(dateError.id);
    expect(document.activeElement).toBe(titleInput);

    fireEvent.change(titleInput, { target: { value: "상담" } });
    fireEvent.change(dateInput, { target: { value: "2026-09-01" } });
    fireEvent.change(within(creationPanel).getByLabelText("시작 시간"), {
      target: { value: "18:00" },
    });
    const endTimeInput = within(creationPanel).getByLabelText("종료 시간");
    fireEvent.change(endTimeInput, { target: { value: "17:00" } });
    fireEvent.click(
      within(creationPanel).getByRole("button", { name: "저장" }),
    );

    const timeError = within(creationPanel).getByText(
      "종료 시간은 시작 시간보다 빠를 수 없어요.",
    );
    expect(endTimeInput.getAttribute("aria-describedby")).toBe(timeError.id);
    await waitFor(() => expect(document.activeElement).toBe(endTimeInput));
  });

  it("제출 중 상태를 입력 View에 전달해 취소와 중복 저장을 막는다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockResolvedValue(
      createAuthenticatedChecklist(),
    );
    let resolveSubmission: ((result: boolean) => void) | undefined;
    const onSubmitAppointment = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveSubmission = resolve;
        }),
    );
    renderChecklistFeature(
      ["/checklist?taskId=checklist-item-500"],
      onSubmitAppointment,
    );

    const detailPanel = await screen.findByRole("complementary", {
      name: "청첩장 문구 정하기",
    });
    fireEvent.click(
      within(detailPanel).getByRole("button", { name: "일정 추가" }),
    );
    const creationPanel = screen.getByRole("complementary", {
      name: "일정 추가",
    });
    fireEvent.change(
      within(creationPanel).getByRole("textbox", { name: /제목/ }),
      {
        target: { value: "상담" },
      },
    );
    fireEvent.change(within(creationPanel).getByLabelText(/날짜/), {
      target: { value: "2026-09-01" },
    });
    fireEvent.click(
      within(creationPanel).getByRole("button", { name: "저장" }),
    );

    const submittingButton = await within(creationPanel).findByRole("button", {
      name: "저장 중",
    });
    const cancelButton = within(creationPanel).getByRole("button", {
      name: "취소",
    });
    expect((submittingButton as HTMLButtonElement).disabled).toBe(true);
    expect(submittingButton.getAttribute("aria-busy")).toBe("true");
    expect((cancelButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(submittingButton);
    fireEvent.click(cancelButton);
    expect(onSubmitAppointment).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("complementary", { name: "일정 추가" }),
    ).toBeTruthy();

    await act(async () => resolveSubmission?.(true));
    await waitFor(() =>
      expect(
        screen.queryByRole("complementary", { name: "일정 추가" }),
      ).toBeNull(),
    );
  });

  it("제출 실패 시 alert와 별도의 오류 요약에 초점을 이동하고 입력을 유지한다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockResolvedValue(
      createAuthenticatedChecklist(),
    );
    const onSubmitAppointment = vi
      .fn()
      .mockRejectedValue(new Error("network detail"));
    renderChecklistFeature(
      ["/checklist?taskId=checklist-item-500"],
      onSubmitAppointment,
    );
    const detailPanel = await screen.findByRole("complementary", {
      name: "청첩장 문구 정하기",
    });
    fireEvent.click(
      within(detailPanel).getByRole("button", { name: "일정 추가" }),
    );
    const creationPanel = screen.getByRole("complementary", {
      name: "일정 추가",
    });
    const titleInput = within(creationPanel).getByRole("textbox", {
      name: /제목/,
    });
    fireEvent.change(titleInput, { target: { value: "상담" } });
    fireEvent.change(within(creationPanel).getByLabelText(/날짜/), {
      target: { value: "2026-09-01" },
    });
    fireEvent.click(
      within(creationPanel).getByRole("button", { name: "저장" }),
    );

    const alert = await within(creationPanel).findByRole("alert");
    const summary = alert.parentElement;
    expect(alert.textContent).toBe(
      "일정을 저장하지 못했어요. 다시 시도해 주세요.",
    );
    expect(summary?.getAttribute("tabindex")).toBe("-1");
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect(document.activeElement).not.toBe(alert);
    expect((titleInput as HTMLInputElement).value).toBe("상담");
    expect(onSubmitAppointment).toHaveBeenCalledOnce();
  });

  it("일정 입력 취소 시 draft를 버리고 진입점으로 초점을 복원한다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockResolvedValue(
      createAuthenticatedChecklist(),
    );
    renderChecklistFeature(["/checklist?taskId=checklist-item-500"]);

    const detailPanel = await screen.findByRole("complementary", {
      name: "청첩장 문구 정하기",
    });
    fireEvent.click(
      within(detailPanel).getByRole("button", { name: "일정 추가" }),
    );
    fireEvent.change(screen.getByLabelText(/제목/), {
      target: { value: "버릴 일정" },
    });
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    const restoredButton = screen.getByRole("button", { name: "일정 추가" });
    await waitFor(() => expect(restoredButton).toBe(document.activeElement));
    fireEvent.click(restoredButton);
    expect(
      (screen.getByRole("textbox", { name: /제목/ }) as HTMLInputElement).value,
    ).toBe("");
  });

  it("일정 입력 중 다른 할 일을 선택하면 새 선택 항목의 초점을 유지하고 draft를 버린다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    const checklist = createAuthenticatedChecklist();
    checklist.categories[0].items.push({
      appointments: [],
      categoryId: "10",
      checklistItemId: 501,
      id: "checklist-item-501",
      sourceCatalogItemId: 101,
      status: "prev",
      title: "예식장 상담하기",
    });
    repositoryMocks.getChecklist.mockResolvedValue(checklist);
    renderChecklistFeature(["/checklist?taskId=checklist-item-500"]);

    const firstDetailPanel = await screen.findByRole("complementary", {
      name: "청첩장 문구 정하기",
    });
    fireEvent.click(
      within(firstDetailPanel).getByRole("button", { name: "일정 추가" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: /제목/ }), {
      target: { value: "다른 할 일에 노출되면 안 되는 일정" },
    });

    const nextTaskButton = screen.getByRole("button", {
      name: /예식장 상담하기/,
    });
    nextTaskButton.focus();
    fireEvent.click(nextTaskButton);

    expect(
      await screen.findByRole("complementary", { name: "예식장 상담하기" }),
    ).toBeTruthy();
    expect(document.activeElement).toBe(nextTaskButton);
    expect(
      screen.queryByRole("complementary", { name: "일정 추가" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "일정 추가" }));
    expect(
      (screen.getByRole("textbox", { name: /제목/ }) as HTMLInputElement).value,
    ).toBe("");
  });

  it("로그인 모바일 상세에서 일정 입력을 열고 Escape로 닫아 초점을 복원한다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockResolvedValue(
      createAuthenticatedChecklist(),
    );
    renderChecklistFeature(["/checklist?taskId=checklist-item-500"], vi.fn());

    const detailPage = await screen.findByRole("region", {
      name: "청첩장 문구 정하기",
    });
    fireEvent.click(
      within(detailPage).getByRole("button", { name: "일정 추가" }),
    );

    const creationDialog = screen.getByRole("dialog", { name: "일정 추가" });
    expect(within(creationDialog).getByRole("textbox", { name: /제목/ })).toBe(
      document.activeElement,
    );
    const backButton = within(creationDialog).getByRole("button", {
      name: "할 일 상세로 돌아가기",
    });
    const saveButton = within(creationDialog).getByRole("button", {
      name: "저장",
    });
    backButton.focus();
    fireEvent.keyDown(backButton, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(saveButton);
    fireEvent.keyDown(saveButton, { key: "Tab" });
    expect(document.activeElement).toBe(backButton);
    within(creationDialog).getByRole("textbox", { name: /제목/ }).focus();
    fireEvent.keyDown(document.activeElement ?? creationDialog, {
      key: "Escape",
    });

    expect(screen.queryByRole("dialog", { name: "일정 추가" })).toBeNull();
    const restoredPage = screen.getByRole("region", {
      name: "청첩장 문구 정하기",
    });
    await waitFor(() =>
      expect(
        within(restoredPage).getByRole("button", { name: "일정 추가" }),
      ).toBe(document.activeElement),
    );
  });

  it("로그인 사용자는 CTA에서 공통 draft를 쓰는 추가 패널을 연다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockResolvedValue(
      createAuthenticatedChecklist(),
    );
    renderChecklistFeature();

    fireEvent.click(await screen.findByRole("button", { name: "할 일 추가" }));

    expect(getCurrentUrl()).toBe("/checklist?addTask=true");
    const panel = screen.getByRole("complementary", { name: "할 일 추가" });
    expect(within(panel).getByRole("textbox", { name: /할 일 제목/ })).toBe(
      document.activeElement,
    );
    expect(
      within(panel).getByRole("combobox", { name: /카테고리/ }),
    ).toBeTruthy();
    expect(
      within(panel).getByRole("option", { name: "예식 준비" }),
    ).toBeTruthy();
    expect(
      within(panel).getByRole("option", { name: "예복 준비" }),
    ).toBeTruthy();
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
  });

  it("실제 생성 명령을 연결하고 성공 후 작성 상태와 URL을 초기화한다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockResolvedValue(
      createAuthenticatedChecklist(),
    );
    let resolveCreation: () => void = () => undefined;
    repositoryMocks.createCustomItem.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCreation = resolve;
        }),
    );
    renderChecklistFeature(["/checklist?filter=remaining"]);
    const addTaskButton = await screen.findByRole("button", {
      name: "할 일 추가",
    });
    fireEvent.click(addTaskButton);
    const panel = screen.getByRole("complementary", { name: "할 일 추가" });
    fireEvent.change(within(panel).getByRole("textbox"), {
      target: { value: "  청첩장 문구 확정  " },
    });
    fireEvent.change(within(panel).getByRole("combobox"), {
      target: { value: "10" },
    });

    fireEvent.click(within(panel).getByRole("button", { name: "추가" }));

    await waitFor(() =>
      expect(repositoryMocks.createCustomItem).toHaveBeenCalledWith(
        "청첩장 문구 확정",
        "10",
        expect.any(AbortSignal),
      ),
    );
    expect(
      within(panel)
        .getByRole("button", { name: "추가 중" })
        .hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.click(within(panel).getByRole("button", { name: "추가 중" }));
    expect(repositoryMocks.createCustomItem).toHaveBeenCalledOnce();

    await act(async () => {
      resolveCreation();
    });

    await waitFor(() =>
      expect(getCurrentUrl()).toBe("/checklist?filter=remaining"),
    );
    expect(
      screen.queryByRole("complementary", { name: "할 일 추가" }),
    ).toBeNull();
    expect(document.activeElement).toBe(addTaskButton);
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();

    fireEvent.click(addTaskButton);
    const reopenedPanel = screen.getByRole("complementary", {
      name: "할 일 추가",
    });
    expect(
      (within(reopenedPanel).getByRole("textbox") as HTMLInputElement).value,
    ).toBe("");
    expect(
      (within(reopenedPanel).getByRole("combobox") as HTMLSelectElement).value,
    ).toBe("");
  });

  it("생성 실패 시 작성값과 패널을 유지하고 오류를 지운 뒤 재시도한다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockResolvedValue(
      createAuthenticatedChecklist(),
    );
    repositoryMocks.createCustomItem
      .mockRejectedValueOnce(
        new CustomChecklistItemCreationError(
          "category-not-found",
          "카테고리를 찾을 수 없습니다.",
        ),
      )
      .mockResolvedValueOnce(undefined);
    renderChecklistFeature();
    fireEvent.click(await screen.findByRole("button", { name: "할 일 추가" }));
    const panel = screen.getByRole("complementary", { name: "할 일 추가" });
    const title = within(panel).getByRole("textbox");
    fireEvent.change(title, { target: { value: "작성값 유지" } });
    fireEvent.change(within(panel).getByRole("combobox"), {
      target: { value: "20" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "추가" }));

    expect((await within(panel).findByRole("alert")).textContent).toBe(
      "카테고리를 찾을 수 없습니다.",
    );
    expect((title as HTMLInputElement).value).toBe("작성값 유지");
    expect(getCurrentUrl()).toBe("/checklist?addTask=true");

    fireEvent.click(within(panel).getByRole("button", { name: "추가" }));
    await waitFor(() =>
      expect(
        within(panel).queryByText("카테고리를 찾을 수 없습니다."),
      ).toBeNull(),
    );
    await waitFor(() => expect(getCurrentUrl()).toBe("/checklist"));
    expect(repositoryMocks.createCustomItem).toHaveBeenCalledTimes(2);
  });

  it("생성 인증 오류를 refreshAuth에 연결하고 인증 확인 중 draft와 URL을 유지한다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockResolvedValue(
      createAuthenticatedChecklist(),
    );
    repositoryMocks.createCustomItem.mockRejectedValue(
      new MyChecklistAuthenticationRequiredError(),
    );
    const view = renderChecklistFeature();
    fireEvent.click(await screen.findByRole("button", { name: "할 일 추가" }));
    const panel = screen.getByRole("complementary", { name: "할 일 추가" });
    fireEvent.change(within(panel).getByRole("textbox"), {
      target: { value: "인증 후 유지" },
    });
    fireEvent.change(within(panel).getByRole("combobox"), {
      target: { value: "10" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "추가" }));

    await waitFor(() => expect(authMocks.refreshAuth).toHaveBeenCalledOnce());
    authMocks.authState = { status: "loading" };
    view.rerender(<ChecklistFeatureTestApp />);
    expect(getCurrentUrl()).toBe("/checklist?addTask=true");

    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    view.rerender(<ChecklistFeatureTestApp />);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "로그인이 필요합니다.",
    );
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(
      "인증 후 유지",
    );
  });

  it("인증 사용자가 바뀌면 이전 작성 세션과 addTask URL을 초기화한다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "first" },
    };
    repositoryMocks.getChecklist.mockResolvedValue(
      createAuthenticatedChecklist(),
    );
    const view = renderChecklistFeature();
    fireEvent.click(await screen.findByRole("button", { name: "할 일 추가" }));
    const panel = screen.getByRole("complementary", { name: "할 일 추가" });
    fireEvent.change(within(panel).getByRole("textbox"), {
      target: { value: "첫 사용자 작성값" },
    });
    fireEvent.change(within(panel).getByRole("combobox"), {
      target: { value: "10" },
    });

    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "second" },
    };
    view.rerender(<ChecklistFeatureTestApp />);

    await waitFor(() => expect(getCurrentUrl()).toBe("/checklist"));
    expect(
      screen.queryByRole("complementary", { name: "할 일 추가" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "할 일 추가" }));
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("");
  });

  it("추가 화면과 상세 패널을 URL에서 상호 배타적으로 전환한다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockResolvedValue(
      createAuthenticatedChecklist(),
    );
    renderChecklistFeature(["/checklist?filter=remaining"]);

    fireEvent.click(await screen.findByRole("button", { name: "할 일 추가" }));
    expect(getCurrentUrl()).toBe("/checklist?filter=remaining&addTask=true");
    expect(
      screen.getByRole("complementary", { name: "할 일 추가" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /청첩장 문구 정하기/ }));
    expect(getCurrentUrl()).toBe(
      "/checklist?filter=remaining&taskId=checklist-item-500",
    );
    expect(
      screen.getByRole("complementary", { name: "청첩장 문구 정하기" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("complementary", { name: "할 일 추가" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "할 일 추가" }));
    expect(getCurrentUrl()).toBe("/checklist?filter=remaining&addTask=true");
    expect(
      screen.getByRole("complementary", { name: "할 일 추가" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("complementary", { name: "청첩장 문구 정하기" }),
    ).toBeNull();
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
  });
});

describe("ChecklistFeature 상세 URL 선택", () => {
  it("할 일 클릭과 닫기·Escape를 URL에 반영하고 다른 query와 포커스를 유지한다", async () => {
    const checklist = createChecklist("URL 인코딩 할 일");
    checklist.categories[1]!.items[0]!.id = "task-한글";
    repositoryMocks.getChecklist.mockResolvedValue(checklist);
    renderChecklistFeature(["/checklist?filter=remaining"]);

    const taskButton = await screen.findByRole("button", {
      name: /URL 인코딩 할 일/,
    });
    fireEvent.click(taskButton);

    expect(getCurrentUrl()).toBe(
      "/checklist?filter=remaining&taskId=task-%ED%95%9C%EA%B8%80",
    );
    expect(
      screen.getByRole("complementary", { name: "URL 인코딩 할 일" }),
    ).toBeTruthy();
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "할 일 상세 닫기" }));

    expect(getCurrentUrl()).toBe("/checklist?filter=remaining");
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(document.activeElement).toBe(taskButton);

    fireEvent.click(taskButton);
    fireEvent.keyDown(window, { key: "Escape" });

    expect(getCurrentUrl()).toBe("/checklist?filter=remaining");
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(document.activeElement).toBe(taskButton);
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
  });

  it("브라우저 뒤로가기로 이전 선택과 목록 상태를 복원한다", async () => {
    const checklist = createChecklist("첫 번째 할 일");
    checklist.categories[1]!.items.push({
      ...checklist.categories[1]!.items[0]!,
      id: "catalog-item-102",
      sourceCatalogItemId: 102,
      title: "두 번째 할 일",
    });
    repositoryMocks.getChecklist.mockResolvedValue(checklist);
    renderChecklistFeature();

    const firstTaskButton = await screen.findByRole("button", {
      name: /첫 번째 할 일/,
    });
    fireEvent.click(firstTaskButton);
    fireEvent.click(screen.getByRole("button", { name: /두 번째 할 일/ }));
    expect(getCurrentUrl()).toBe("/checklist?taskId=catalog-item-102");

    fireEvent.click(screen.getByRole("button", { name: "브라우저 뒤로가기" }));

    expect(getCurrentUrl()).toBe("/checklist?taskId=catalog-item-101");
    expect(
      screen.getByRole("complementary", { name: "첫 번째 할 일" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "브라우저 뒤로가기" }));

    expect(getCurrentUrl()).toBe("/checklist");
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(document.activeElement).toBe(firstTaskButton);
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
  });

  it("모바일에서 URL로 상세를 열고 브라우저 뒤로가기로 목록에 복귀한다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    renderChecklistFeature();

    fireEvent.click(
      await screen.findByRole("button", { name: /로컬 체크리스트 항목/ }),
    );

    expect(getCurrentUrl()).toBe("/checklist?taskId=catalog-item-101");
    expect(
      screen.getByRole("region", { name: "로컬 체크리스트 항목" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "브라우저 뒤로가기" }));

    expect(getCurrentUrl()).toBe("/checklist");
    expect(
      screen.queryByRole("region", { name: "로컬 체크리스트 항목" }),
    ).toBeNull();
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
  });

  it("모바일 목록에서 연 상세의 상단 뒤로가기는 중복 목록 entry를 남기지 않는다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    renderChecklistFeature(["/outside", "/checklist"]);

    fireEvent.click(
      await screen.findByRole("button", { name: /로컬 체크리스트 항목/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "체크리스트로 돌아가기" }),
    );

    expect(getCurrentUrl()).toBe("/checklist");

    fireEvent.click(screen.getByRole("button", { name: "브라우저 뒤로가기" }));
    expect(getCurrentUrl()).toBe("/outside");
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
  });

  it("모바일 상세 직접 접근의 상단 뒤로가기는 현재 entry를 목록으로 교체한다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    renderChecklistFeature([
      "/outside",
      "/checklist?filter=remaining&taskId=catalog-item-101",
    ]);

    const detailPage = await screen.findByRole("region", {
      name: "로컬 체크리스트 항목",
    });
    fireEvent.click(
      within(detailPage).getByRole("button", {
        name: "체크리스트로 돌아가기",
      }),
    );

    expect(getCurrentUrl()).toBe("/checklist?filter=remaining");
    expect(
      screen.queryByRole("region", { name: "로컬 체크리스트 항목" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "브라우저 뒤로가기" }));
    expect(getCurrentUrl()).toBe("/outside");
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
  });

  it("모바일 상세 직접 접근은 로딩과 오류 중에도 상세 셸과 안전한 뒤로가기를 유지한다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    let rejectChecklist: (reason?: unknown) => void = () => undefined;
    repositoryMocks.getChecklist.mockImplementation(
      () =>
        new Promise<ChecklistQueryModel>((_resolve, reject) => {
          rejectChecklist = reject;
        }),
    );
    renderChecklistFeature([
      "/outside",
      "/checklist?filter=remaining&taskId=catalog-item-101",
    ]);

    const loadingDetailPage = screen.getByRole("region", {
      name: "할 일 상세",
    });
    expect(within(loadingDetailPage).getByRole("status")).toBeTruthy();

    await act(async () => {
      rejectChecklist(new ChecklistQueryLoadError());
    });

    const errorDetailPage = await screen.findByRole("region", {
      name: "할 일 상세",
    });
    expect(within(errorDetailPage).getByRole("alert")).toBeTruthy();
    fireEvent.click(
      within(errorDetailPage).getByRole("button", {
        name: "체크리스트로 돌아가기",
      }),
    );

    expect(getCurrentUrl()).toBe("/checklist?filter=remaining");
    expect(screen.queryByRole("region", { name: "할 일 상세" })).toBeNull();
  });

  it("breakpoint 전환은 URL과 history를 변경하지 않고 같은 항목을 유지한다", async () => {
    const media = installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, false);
    renderChecklistFeature([
      "/checklist?source=before",
      "/checklist?taskId=catalog-item-101",
    ]);

    expect(
      await screen.findByRole("complementary", {
        name: "로컬 체크리스트 항목",
      }),
    ).toBeTruthy();

    act(() => media.setMatches(true));
    expect(getCurrentUrl()).toBe("/checklist?taskId=catalog-item-101");
    expect(
      screen.getByRole("region", { name: "로컬 체크리스트 항목" }),
    ).toBeTruthy();

    act(() => media.setMatches(false));
    expect(getCurrentUrl()).toBe("/checklist?taskId=catalog-item-101");
    expect(
      screen.getByRole("complementary", {
        name: "로컬 체크리스트 항목",
      }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "브라우저 뒤로가기" }));
    expect(getCurrentUrl()).toBe("/checklist?source=before");
    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
  });

  it("상세 URL을 로딩 중 유지하고 데이터가 준비되면 패널을 연다", async () => {
    let resolveChecklist: (checklist: ChecklistQueryModel) => void = () =>
      undefined;
    repositoryMocks.getChecklist.mockImplementation(
      () =>
        new Promise<ChecklistQueryModel>((resolve) => {
          resolveChecklist = resolve;
        }),
    );
    renderChecklistFeature([
      "/checklist?filter=remaining&taskId=catalog-item-101",
    ]);

    expect(screen.getByText("체크리스트를 불러오고 있어요.")).toBeTruthy();
    expect(getCurrentUrl()).toBe(
      "/checklist?filter=remaining&taskId=catalog-item-101",
    );

    await act(async () => {
      resolveChecklist(createChecklist("직접 접근한 할 일"));
    });

    expect(
      await screen.findByRole("complementary", {
        name: "직접 접근한 할 일",
      }),
    ).toBeTruthy();
    expect(getCurrentUrl()).toBe(
      "/checklist?filter=remaining&taskId=catalog-item-101",
    );
  });

  it("플래너 일정 요청 URL을 직접 열거나 새로고침하면 해당 상세의 일정 입력을 한 번 연다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockResolvedValue(
      createAuthenticatedChecklist(),
    );
    const url = "/checklist?taskId=checklist-item-500&addAppointment=true";

    const first = renderChecklistFeature([url]);
    expect(
      await screen.findByRole("complementary", { name: "일정 추가" }),
    ).toBeTruthy();
    await waitFor(() =>
      expect(getCurrentUrl()).toBe("/checklist?taskId=checklist-item-500"),
    );
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(
      screen.queryByRole("complementary", { name: "일정 추가" }),
    ).toBeNull();
    expect(getCurrentUrl()).toBe("/checklist?taskId=checklist-item-500");

    first.unmount();
    renderChecklistFeature([url]);
    expect(
      await screen.findByRole("complementary", { name: "일정 추가" }),
    ).toBeTruthy();
  });

  it("플래너에서 연 일정 입력을 취소한 뒤 뒤로 가면 플래너로 돌아간다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockResolvedValue(
      createAuthenticatedChecklist(),
    );
    renderChecklistFeature([
      "/planner",
      "/checklist?taskId=checklist-item-500&addAppointment=true",
    ]);

    expect(
      await screen.findByRole("complementary", { name: "일정 추가" }),
    ).toBeTruthy();
    await waitFor(() =>
      expect(getCurrentUrl()).toBe("/checklist?taskId=checklist-item-500"),
    );
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    fireEvent.click(screen.getByRole("button", { name: "브라우저 뒤로가기" }));
    expect(getCurrentUrl()).toBe("/planner");
  });

  it("모바일에서 자동 일정 입력을 닫고 상세 뒤로 가기를 누르면 플래너로 돌아간다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockResolvedValue(
      createAuthenticatedChecklist(),
    );
    renderChecklistFeature([
      "/planner",
      {
        pathname: "/checklist",
        search: "?taskId=checklist-item-500&addAppointment=true",
        state: { checklistDetailDepth: 1 },
      },
    ]);

    const creationDialog = await screen.findByRole("dialog", {
      name: "일정 추가",
    });
    await waitFor(() =>
      expect(getCurrentUrl()).toBe("/checklist?taskId=checklist-item-500"),
    );
    fireEvent.click(
      within(creationDialog).getByRole("button", {
        name: "할 일 상세로 돌아가기",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "체크리스트로 돌아가기" }),
    );

    expect(getCurrentUrl()).toBe("/planner");
  });

  it("존재하지 않는 플래너 일정 대상은 자동 입력 없이 요청 파라미터와 선택을 정리한다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockResolvedValue(
      createAuthenticatedChecklist(),
    );
    renderChecklistFeature([
      "/checklist?taskId=checklist-item-999&addAppointment=true",
    ]);

    await waitFor(() => expect(getCurrentUrl()).toBe("/checklist"));
    expect(
      screen.queryByRole("complementary", { name: "일정 추가" }),
    ).toBeNull();
  });

  it("잘못된 taskId를 로딩 완료 후 replace로 제거한다", async () => {
    let resolveChecklist: (checklist: ChecklistQueryModel) => void = () =>
      undefined;
    repositoryMocks.getChecklist.mockImplementation(
      () =>
        new Promise<ChecklistQueryModel>((resolve) => {
          resolveChecklist = resolve;
        }),
    );
    renderChecklistFeature([
      "/checklist?source=previous",
      "/checklist?filter=remaining&taskId=missing-task",
    ]);

    expect(getCurrentUrl()).toBe(
      "/checklist?filter=remaining&taskId=missing-task",
    );

    await act(async () => {
      resolveChecklist(createChecklist());
    });

    await waitFor(() =>
      expect(getCurrentUrl()).toBe("/checklist?filter=remaining"),
    );
    expect(screen.queryByRole("complementary")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "브라우저 뒤로가기" }));
    expect(getCurrentUrl()).toBe("/checklist?source=previous");
  });

  it("새 데이터 요청 중에는 taskId를 유지하고 선택 항목이 사라진 결과에서 함께 정리한다", async () => {
    let resolveRefreshedChecklist: (
      checklist: ChecklistQueryModel,
    ) => void = () => undefined;
    repositoryMocks.getChecklist
      .mockResolvedValueOnce(createChecklist("사라질 할 일"))
      .mockImplementationOnce(
        () =>
          new Promise<ChecklistQueryModel>((resolve) => {
            resolveRefreshedChecklist = resolve;
          }),
      );
    const view = renderChecklistFeature([
      "/checklist?filter=remaining&taskId=catalog-item-101",
    ]);
    expect(
      await screen.findByRole("complementary", { name: "사라질 할 일" }),
    ).toBeTruthy();

    repositoryMocks.checklistRevision = 1;
    view.rerender(<ChecklistFeatureTestApp />);
    await waitFor(() =>
      expect(repositoryMocks.getChecklist).toHaveBeenCalledTimes(2),
    );

    expect(getCurrentUrl()).toBe(
      "/checklist?filter=remaining&taskId=catalog-item-101",
    );

    await act(async () => {
      resolveRefreshedChecklist({
        categories: [{ id: "10", items: [], title: "첫 번째 카테고리" }],
      });
    });

    await waitFor(() =>
      expect(getCurrentUrl()).toBe("/checklist?filter=remaining"),
    );
    expect(screen.queryByRole("complementary")).toBeNull();
  });
});

describe("ChecklistFeature 조회 상태와 요청 수명", () => {
  it("Catalog 카테고리가 없으면 전체 빈 상태를 표시한다", async () => {
    repositoryMocks.getChecklist.mockResolvedValue({ categories: [] });

    renderChecklistFeature();

    expect(await screen.findByText("표시할 체크리스트가 없어요.")).toBeTruthy();
  });

  it("항목이 없는 카테고리는 전체 빈 화면 대신 0개와 0%로 표시한다", async () => {
    repositoryMocks.getChecklist.mockResolvedValue({
      categories: [{ id: "10", items: [], title: "빈 카테고리" }],
    });

    renderChecklistFeature();

    const category = (
      await screen.findByRole("heading", { name: "빈 카테고리" })
    ).closest("section");
    expect(category).not.toBeNull();
    expect(within(category!).getByText("0개")).toBeTruthy();
    expect(within(category!).getByText("0%")).toBeTruthy();
    expect(screen.queryByText("표시할 체크리스트가 없어요.")).toBeNull();
  });

  it("일반 오류를 화면 안에서 안내하고 다시 조회한다", async () => {
    repositoryMocks.getChecklist
      .mockRejectedValueOnce(new ChecklistQueryLoadError())
      .mockResolvedValueOnce(createChecklist("재시도 결과"));

    renderChecklistFeature();

    expect(
      await screen.findByText("체크리스트를 불러오지 못했어요."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByText("재시도 결과")).toBeTruthy();
    expect(repositoryMocks.getChecklist).toHaveBeenCalledTimes(2);
  });

  it("인증 오류를 refreshAuth 흐름에 연결한다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockRejectedValue(
      new ChecklistQueryAuthenticationRequiredError(),
    );

    renderChecklistFeature();

    expect(
      await screen.findByText(
        "로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요.",
      ),
    ).toBeTruthy();
    expect(authMocks.refreshAuth).toHaveBeenCalledOnce();
  });

  it("취소 오류를 사용자 오류로 표시하지 않는다", async () => {
    repositoryMocks.getChecklist.mockRejectedValue(
      new ChecklistQueryRequestAbortedError(),
    );

    renderChecklistFeature();

    await waitFor(() =>
      expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce(),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      "체크리스트를 불러오고 있어요.",
    );
  });

  it("audience가 바뀌면 이전 요청을 취소하고 오래된 결과를 무시한다", async () => {
    let firstSignal: AbortSignal | undefined;
    let resolveGuest: (value: ChecklistQueryModel) => void = () => undefined;
    let resolveAuthenticated: (value: ChecklistQueryModel) => void = () =>
      undefined;
    repositoryMocks.getChecklist
      .mockImplementationOnce((_audience, signal?: AbortSignal) => {
        firstSignal = signal;
        return new Promise<ChecklistQueryModel>((resolve) => {
          resolveGuest = resolve;
        });
      })
      .mockImplementationOnce(
        () =>
          new Promise<ChecklistQueryModel>((resolve) => {
            resolveAuthenticated = resolve;
          }),
      );
    const view = renderChecklistFeature();
    await waitFor(() => expect(firstSignal).toBeDefined());

    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    view.rerender(<ChecklistFeatureTestApp />);

    expect(firstSignal?.aborted).toBe(true);
    await act(async () => {
      resolveGuest(createChecklist("오래된 guest 결과"));
    });
    expect(screen.queryByText("오래된 guest 결과")).toBeNull();

    await act(async () => {
      resolveAuthenticated(createChecklist("최신 서버 결과"));
    });
    expect(await screen.findByText("최신 서버 결과")).toBeTruthy();
  });

  it("인증 대상의 Repository가 바뀌면 이전 요청을 취소한다", async () => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "first" },
    };
    let firstSignal: AbortSignal | undefined;
    const firstGetChecklist = vi.fn(
      (_audience: string, signal?: AbortSignal) => {
        firstSignal = signal;
        return new Promise<ChecklistQueryModel>(() => undefined);
      },
    );
    repositoryMocks.current = { getChecklist: firstGetChecklist };
    const view = renderChecklistFeature();
    await waitFor(() => expect(firstSignal).toBeDefined());

    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "second" },
    };
    const secondGetChecklist = vi
      .fn()
      .mockResolvedValue(createChecklist("두 번째 사용자 결과"));
    repositoryMocks.current = { getChecklist: secondGetChecklist };
    view.rerender(<ChecklistFeatureTestApp />);

    expect(firstSignal?.aborted).toBe(true);
    expect(await screen.findByText("두 번째 사용자 결과")).toBeTruthy();
  });

  it("화면에서 제거되면 진행 중 요청을 취소한다", async () => {
    let requestSignal: AbortSignal | undefined;
    repositoryMocks.getChecklist.mockImplementation(
      (_audience, signal?: AbortSignal) => {
        requestSignal = signal;
        return new Promise<ChecklistQueryModel>(() => undefined);
      },
    );
    const view = renderChecklistFeature();
    await waitFor(() => expect(requestSignal).toBeDefined());

    view.unmount();

    expect(requestSignal?.aborted).toBe(true);
  });
});

describe("ChecklistFeature 기존 UI", () => {
  it("카테고리를 기존 순서대로 표시하고 accordion을 열고 닫는다", async () => {
    renderChecklistFeature();
    await screen.findByText("로컬 체크리스트 항목");

    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((heading) => within(heading).getByText(/카테고리$/).textContent),
    ).toEqual(["두 번째 카테고리", "첫 번째 카테고리"]);
    const categoryButton = screen.getByRole("button", {
      name: "첫 번째 카테고리",
    });
    expect(categoryButton.getAttribute("aria-expanded")).toBe("true");
    expect(categoryButton.getAttribute("aria-controls")).toBeTruthy();

    fireEvent.click(categoryButton);
    expect(categoryButton.getAttribute("aria-expanded")).toBe("false");
    expect(
      screen.queryByRole("list", { name: "첫 번째 카테고리 할 일" }),
    ).toBeNull();

    fireEvent.click(categoryButton);
    expect(categoryButton.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByRole("list", { name: "첫 번째 카테고리 할 일" }),
    ).toBeTruthy();
  });
});

describe("ChecklistFeature 할 일 편집 조정", () => {
  beforeEach(() => {
    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    repositoryMocks.getChecklist.mockResolvedValue(
      createAuthenticatedChecklist(),
    );
  });

  it("카테고리 변경을 Command Repository에 위임하고 URL과 공통 GET을 유지한다", async () => {
    renderChecklistFeature([
      "/checklist?filter=remaining&taskId=checklist-item-500",
    ]);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "카테고리 변경, 현재 예식 준비",
      }),
    );
    fireEvent.click(screen.getByRole("option", { name: "예복 준비" }));

    await waitFor(() =>
      expect(repositoryMocks.changeItemCategory).toHaveBeenCalledWith(
        500,
        20,
        expect.any(AbortSignal),
      ),
    );

    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
    expect(getCurrentUrl()).toBe(
      "/checklist?filter=remaining&taskId=checklist-item-500",
    );
  });

  it("카테고리 수정 인증 오류의 재확인 흐름에서도 상세과 팝오버를 유지한다", async () => {
    repositoryMocks.changeItemCategory.mockRejectedValue(
      new MyChecklistAuthenticationRequiredError(),
    );
    const view = renderChecklistFeature([
      "/checklist?taskId=checklist-item-500",
    ]);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "카테고리 변경, 현재 예식 준비",
      }),
    );
    fireEvent.click(screen.getByRole("option", { name: "예복 준비" }));

    await waitFor(() => expect(authMocks.refreshAuth).toHaveBeenCalledOnce());
    authMocks.authState = { status: "loading" };
    view.rerender(<ChecklistFeatureTestApp />);
    expect(screen.queryByRole("listbox")).toBeNull();

    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    view.rerender(<ChecklistFeatureTestApp />);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "로그인이 필요합니다.",
    );
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(
      screen.getByRole("complementary", { name: "청첩장 문구 정하기" }),
    ).toBeTruthy();
  });

  it("제목 변경을 Command Repository에 위임하고 URL과 공통 GET을 유지한다", async () => {
    renderChecklistFeature([
      "/checklist?filter=remaining&taskId=checklist-item-500",
    ]);

    fireEvent.click(
      await screen.findByRole("button", { name: "할 일 제목 수정" }),
    );
    const input = screen.getByRole("textbox", { name: "할 일 제목" });
    fireEvent.change(input, { target: { value: "  청첩장 문구 확정  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(repositoryMocks.changeItemTitle).toHaveBeenCalledWith(
        500,
        "청첩장 문구 확정",
        expect.any(AbortSignal),
      ),
    );

    expect(repositoryMocks.getChecklist).toHaveBeenCalledOnce();
    expect(getCurrentUrl()).toBe(
      "/checklist?filter=remaining&taskId=checklist-item-500",
    );
  });

  it("상태 변경 후 재조회만 실패하면 부분 성공을 안내하고 다시 조회한다", async () => {
    repositoryMocks.hasRemainingAppointments.mockResolvedValue(true);
    repositoryMocks.changeItemStatus.mockRejectedValue(
      new ChecklistItemChangeError(
        "refresh-failed",
        "상태는 변경됐지만 최신 체크리스트를 불러오지 못했습니다. 다시 조회해주세요.",
      ),
    );
    renderChecklistFeature(["/checklist?taskId=checklist-item-500"]);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "상태 변경, 현재 미완료",
      }),
    );
    fireEvent.click(screen.getByRole("option", { name: "완료" }));
    const dialog = await screen.findByRole("dialog", {
      name: "남은 일정도 완료할까요?",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "함께 완료" }));

    expect(
      await screen.findByText(
        "상태는 변경됐지만 최신 체크리스트를 불러오지 못했습니다. 다시 조회해주세요.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findAllByText("청첩장 문구 정하기")).toHaveLength(2);
    expect(repositoryMocks.getChecklist).toHaveBeenCalledTimes(2);
    expect(repositoryMocks.changeItemStatus).toHaveBeenCalledOnce();
  });

  it("수정 인증 오류의 재확인 흐름이 끝난 뒤에도 상세과 draft를 유지한다", async () => {
    repositoryMocks.changeItemTitle.mockRejectedValue(
      new MyChecklistAuthenticationRequiredError(),
    );
    const view = renderChecklistFeature([
      "/checklist?taskId=checklist-item-500",
    ]);

    fireEvent.click(
      await screen.findByRole("button", { name: "할 일 제목 수정" }),
    );
    const input = screen.getByRole("textbox", { name: "할 일 제목" });
    fireEvent.change(input, { target: { value: "로그인 만료 후 유지" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(authMocks.refreshAuth).toHaveBeenCalledOnce());
    authMocks.authState = { status: "loading" };
    view.rerender(<ChecklistFeatureTestApp />);
    expect(screen.queryByRole("textbox")).toBeNull();

    authMocks.authState = {
      status: "authenticated",
      user: { nickname: "bibbidi" },
    };
    view.rerender(<ChecklistFeatureTestApp />);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "로그인이 필요합니다.",
    );
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(
      "로그인 만료 후 유지",
    );
    expect(
      screen.getByRole("complementary", { name: /제목 수정/ }),
    ).toBeTruthy();
  });
});
