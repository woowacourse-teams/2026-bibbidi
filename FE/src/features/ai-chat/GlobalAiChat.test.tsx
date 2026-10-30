import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  Link,
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MyChecklistProvider } from "../checklist";
import { ServiceLayout } from "../../layouts/ServiceLayout";
import { PreparationRoadmapFeature } from "../preparation";
import { preparationCatalogFixture } from "../preparation/test/fixtures/preparationCatalog.fixture";
import { resetWebAuthSessionForTest } from "../../infrastructure/auth/webSessionManager";
import { MOBILE_LAYOUT_MEDIA_QUERY } from "../../shared/responsive";
import { installMatchMedia } from "../../test/matchMedia";
import type { AuthState } from "../auth/model/auth";

const mocks = vi.hoisted(() => ({
  auth: {
    status: "authenticated",
    user: { id: 1, nickname: "비비디" },
  } as AuthState,
  refresh: vi.fn(),
  stream: vi.fn(),
  catalog: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("../auth", () => ({
  useAuth: () => ({
    authState: mocks.auth,
    refreshAuth: mocks.refresh,
    endAuthentication: vi.fn(),
  }),
  useLogout: () => ({
    isLoggingOut: false,
    logoutErrorMessage: null,
    submit: vi.fn(),
  }),
}));
vi.mock("../app-header", () => ({ AppHeaderSummaryFeature: () => null }));
vi.mock("../catalog", () => ({
  catalogRepository: { getCatalog: mocks.catalog },
}));
vi.mock("./api/streamAiChat", async (original) => ({
  ...(await original<typeof import("./api/streamAiChat")>()),
  streamAiChat: mocks.stream,
}));
vi.mock("../../infrastructure/analytics", () => ({
  analytics: { track: vi.fn() },
}));
const catalog = {
  ...preparationCatalogFixture,
  categories: preparationCatalogFixture.categories.map((c, i) => ({
    ...c,
    id: String((i + 1) * 10),
  })),
  roadmaps: preparationCatalogFixture.roadmaps.map((r, i) => ({
    ...r,
    categoryId: String((i + 1) * 10),
  })),
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
function Location() {
  const l = useLocation();
  return (
    <output aria-label="현재 주소">
      {l.pathname}
      {l.search}
    </output>
  );
}
function NavigationControls() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div>
      <Link to="/calendar">본문 캘린더 링크</Link>
      <button type="button" onClick={() => navigate("/checklist")}>
        화면 이동 버튼
      </button>
      <Link to={`${location.pathname}${location.search}`}>
        현재 화면 다시 열기
      </Link>
      <button type="button" onClick={() => navigate(-1)}>
        이전 화면
      </button>
      <button type="button" onClick={() => navigate(1)}>
        다음 화면
      </button>
    </div>
  );
}
function app() {
  return (
    <MyChecklistProvider sessionKey="global-ai">
      <MemoryRouter initialEntries={["/preparation?categoryId=20"]}>
        <Routes>
          <Route element={<ServiceLayout />}>
            <Route
              path="/preparation"
              element={<PreparationRoadmapFeature />}
            />
            <Route path="/checklist" element={<h1>체크리스트 화면</h1>} />
            <Route path="/calendar" element={<h1>캘린더 화면</h1>} />
          </Route>
        </Routes>
        <Location />
        <NavigationControls />
      </MemoryRouter>
    </MyChecklistProvider>
  );
}
async function openChat() {
  fireEvent.click(await screen.findByRole("button", { name: "AI" }));
  return screen.findByRole("dialog", { name: "AI 채팅" });
}
async function send(text: string) {
  fireEvent.change(await screen.findByRole("textbox"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "메시지 전송" }));
}
function pressOutside(target: Element, button = 0) {
  const event = new MouseEvent("pointerdown", {
    bubbles: true,
    cancelable: true,
    button,
  });
  fireEvent(target, event);
  return event;
}
async function closeChat() {
  const dialog = screen.getByRole("dialog", { name: "AI 채팅" });
  fireEvent.keyDown(dialog, { key: "Escape" });
  if ((dialog as HTMLDialogElement).open)
    fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "AI 채팅" })).toBeNull(),
  );
}
let items: unknown[];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth = { status: "authenticated", user: { id: 1, nickname: "비비디" } };
  items = [];
  mocks.catalog.mockResolvedValue(catalog);
  mocks.stream.mockImplementation(async (_request, receiver) => {
    receiver.onConversation("d67a9265-3f45-4d7f-99f1-b5823054c8d9");
    receiver.onDelta("준비 안내 답변");
    receiver.onRecommendations?.(["101", "201"]);
  });
  mocks.fetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/api/checklists/me") return json({ id: 1, items });
    if (url === "/api/checklists/me/catalog-items") {
      const id = JSON.parse(init!.body as string)[0];
      const item = {
        id: 501,
        catalogItemId: id,
        categoryId: 10,
        title: "추가한 웨딩홀 투어",
        status: "prev",
        createdAt: "2026-10-27T09:00:00",
        appointments: [],
      };
      items = [...items, item];
      return json({ items: [item] }, 201);
    }
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal("fetch", mocks.fetch);
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
  resetWebAuthSessionForTest();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("전역 AI", () => {
  it.each(["authenticated", "guest"] as const)(
    "모바일 %s 사용자가 작은 입력창 바깥을 터치하면 닫고 현재 화면 메뉴로 돌아간다",
    async (audience) => {
      installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
      if (audience === "guest") mocks.auth = { status: "guest" };
      render(app());
      const heading = await screen.findByRole("heading", {
        name: "스드메",
        level: 1,
      });
      const nav = screen.getByRole("navigation", { name: "하단 메뉴" });
      const launcher = within(nav).getByRole("button", { name: "AI" });
      await openChat();
      expect(launcher.getAttribute("aria-expanded")).toBe("true");
      expect(heading.isConnected).toBe(true);
      // 바깥 누름 감지는 화면 반영 뒤 effect에서 붙으므로 감지될 때까지 다시 누른다.
      await waitFor(() => {
        expect(pressOutside(heading).defaultPrevented).toBe(false);
        expect(screen.queryByRole("dialog", { name: "AI 채팅" })).toBeNull();
      });
      expect(launcher.getAttribute("aria-expanded")).toBe("false");
      expect(nav.querySelector('[aria-expanded="true"]')).toBeNull();
      expect(
        within(nav)
          .getByRole("link", { name: "로드맵" })
          .getAttribute("aria-current"),
      ).toBe("page");
      expect(screen.getByLabelText("현재 주소").textContent).toBe(
        "/preparation?categoryId=20",
      );
    },
  );

  it("확장된 모바일 AI 창 안의 조작은 유지하고 바깥에서 닫아도 대화·입력·키보드 상태를 정리한다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    vi.stubGlobal("innerHeight", 844);
    const viewport = Object.assign(new EventTarget(), {
      height: 844,
      offsetTop: 0,
      scale: 1,
    });
    vi.stubGlobal("visualViewport", viewport);
    render(app());
    await openChat();
    const launcher = screen.getByRole("button", { name: "AI" });
    const dialog = screen.getByRole("dialog", { name: "AI 채팅" });
    const input = screen.getByRole<HTMLTextAreaElement>("textbox");
    pressOutside(input);
    act(() => input.focus());
    await send("다음 준비");
    await screen.findByText("준비 안내 답변");
    pressOutside(screen.getByRole("log"));
    pressOutside(screen.getByRole("button", { name: "메시지 전송" }));
    pressOutside(launcher);
    expect(screen.getByRole("dialog", { name: "AI 채팅" })).toBe(dialog);
    fireEvent.change(input, { target: { value: "보존할 질문" } });
    act(() => {
      viewport.height = 420;
      viewport.dispatchEvent(new Event("resize"));
    });
    const layout = screen.getByRole("region", { name: "서비스 화면" });
    expect(layout.hasAttribute("data-ai-keyboard-open")).toBe(true);
    pressOutside(layout);
    expect(screen.queryByRole("dialog", { name: "AI 채팅" })).toBeNull();
    expect(layout.hasAttribute("data-ai-keyboard-open")).toBe(false);
    expect(document.activeElement).not.toBe(input);
    expect(launcher.getAttribute("aria-expanded")).toBe("false");
    await openChat();
    expect(screen.getByRole("textbox")).toBe(input);
    expect(input.value).toBe("보존할 질문");
    act(() => input.focus());
    expect(screen.getByRole("log").textContent).toContain("준비 안내 답변");
  });

  it("모바일 바깥 링크의 이동을 막지 않고 도착한 화면 메뉴를 표시한다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    render(app());
    await openChat();
    const nav = screen.getByRole("navigation", { name: "하단 메뉴" });
    const link = within(nav).getByRole("link", { name: "캘린더" });
    expect(pressOutside(link).defaultPrevented).toBe(false);
    fireEvent.click(link);
    await screen.findByRole("heading", { name: "캘린더 화면" });
    expect(screen.queryByRole("dialog", { name: "AI 채팅" })).toBeNull();
    expect(link.getAttribute("aria-current")).toBe("page");
    expect(
      within(nav)
        .getByRole("button", { name: "AI" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("데스크톱 바깥 클릭과 모바일 보조 버튼은 창을 닫지 않으며 화면 전환 시 감지를 정리한다", async () => {
    const media = installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, false);
    render(app());
    await openChat();
    const layout = screen.getByRole("region", { name: "서비스 화면" });
    const dialog = screen.getByRole("dialog", { name: "AI 채팅" });
    pressOutside(layout);
    expect(screen.getByRole("dialog", { name: "AI 채팅" })).toBe(dialog);
    act(() => media.setMatches(true));
    pressOutside(layout, 2);
    expect(screen.getByRole("dialog", { name: "AI 채팅" })).toBe(dialog);
    act(() => media.setMatches(false));
    pressOutside(layout);
    expect(screen.getByRole("dialog", { name: "AI 채팅" })).toBe(dialog);
    act(() => media.setMatches(true));
    pressOutside(layout);
    expect(screen.queryByRole("dialog", { name: "AI 채팅" })).toBeNull();
  });

  it("로드맵은 전체 본문을 사용하고 헤더 밖에 하나의 AI 진입점만 제공한다", async () => {
    const { container } = render(app());
    await screen.findByRole("heading", { name: "스드메", level: 1 });
    expect(screen.getAllByRole("button", { name: "AI" })).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "AI" }).closest("header"),
    ).toBeNull();
    expect(
      within(screen.getByRole("navigation", { name: "하단 메뉴" })).queryByRole(
        "button",
        { name: "AI" },
      ),
    ).toBeNull();
    expect(
      container.querySelector(".roadmap-workspace [data-aside]"),
    ).toBeNull();
    expect(
      container.querySelector(".roadmap-workspace .ai-chat-feature"),
    ).toBeNull();
    expect(screen.queryByRole("dialog", { name: "AI 채팅" })).toBeNull();
    expect(screen.queryByRole("complementary", { name: "AI 채팅" })).toBeNull();
    expect(mocks.stream).not.toHaveBeenCalled();
  });
  it("페이지 이동과 열고 닫기 후에도 대화·작성 중 입력을 유지하고 현재 화면을 참고한다", async () => {
    render(app());
    await openChat();
    expect(
      screen.queryByRole("button", {
        name: "웨딩홀을 정한 다음엔 뭘 준비할까?",
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "촬영 전에 준비할 일을 정리해줘" }),
    ).toBeNull();
    expect(screen.queryByText(/현재 화면 참고/)).toBeNull();
    await send("다음 준비는?");
    await screen.findByText("준비 안내 답변");
    expect(mocks.stream.mock.calls[0][0]).toMatchObject({
      message: "[현재 화면: 로드맵]\n다음 준비는?",
    });
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "다음 질문 작성 중" },
    });
    await closeChat();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "AI" }),
    );
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "주요 메뉴" })).getByRole(
        "link",
        { name: "체크리스트" },
      ),
    );
    await screen.findByRole("heading", { name: "체크리스트 화면" });
    await openChat();
    expect(screen.queryByText(/현재 화면 참고/)).toBeNull();
    expect(screen.getByText("준비 안내 답변")).toBeTruthy();
    expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(
      "다음 질문 작성 중",
    );
    await send("이 화면에서 할 일");
    await waitFor(() => expect(mocks.stream).toHaveBeenCalledTimes(2));
    expect(mocks.stream.mock.calls[1][0]).toEqual({
      message: "[현재 화면: 체크리스트]\n이 화면에서 할 일",
      conversationId: "d67a9265-3f45-4d7f-99f1-b5823054c8d9",
    });
    await closeChat();
    fireEvent.click(screen.getAllByRole("link", { name: "캘린더" })[0]);
    await screen.findByRole("heading", { name: "캘린더 화면" });
    await openChat();
    expect(screen.queryByText(/현재 화면 참고/)).toBeNull();
    expect(screen.getAllByText("준비 안내 답변")).toHaveLength(2);
  });
  it("플로팅 창을 연 채 배경 페이지를 이동해도 대화와 창을 유지한다", async () => {
    render(app());
    await openChat();
    await send("준비 질문");
    await screen.findByText("준비 안내 답변");
    const dialog = screen.getByRole("dialog", { name: "AI 채팅" });
    expect(dialog.getAttribute("aria-modal")).toBe("false");
    expect(document.body.style.overflow).not.toBe("hidden");
    expect(
      screen.getByRole("region", { name: "서비스 화면" }).style.overflow,
    ).not.toBe("hidden");
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "주요 메뉴" })).getByRole(
        "link",
        { name: "캘린더" },
      ),
    );
    await screen.findByRole("heading", { name: "캘린더 화면" });
    expect(screen.getByRole("dialog", { name: "AI 채팅" })).toBe(dialog);
    expect(screen.queryByText(/현재 화면 참고/)).toBeNull();
    expect(screen.getByText("준비 안내 답변")).toBeTruthy();
  });
  it("플로팅 버튼으로 다시 닫을 수 있다", async () => {
    render(app());
    await openChat();
    const launcher = screen.getByRole("button", { name: "AI" });
    expect(launcher.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(launcher);
    expect(screen.queryByRole("dialog", { name: "AI 채팅" })).toBeNull();
    expect(launcher.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(launcher);
  });
  it("모바일은 작은 입력창부터 열고 입력에 초점을 주면 확장하며 접기·메뉴 이동 후에도 대화를 유지한다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    render(app());
    const nav = screen.getByRole("navigation", { name: "하단 메뉴" });
    expect(
      Array.from(nav.querySelectorAll("a, button"), (item) => item.textContent),
    ).toEqual(["로드맵", "체크리스트", "캘린더", "AI"]);
    const launcher = within(nav).getByRole("button", { name: "AI" });
    launcher.focus();
    await openChat();
    const dialog = screen.getByRole("dialog", { name: "AI 채팅" });
    const input = screen.getByRole<HTMLTextAreaElement>("textbox");
    const layout = screen.getByRole("region", { name: "서비스 화면" });
    expect(dialog.getAttribute("data-expanded")).toBe("false");
    expect(dialog.getAttribute("aria-modal")).toBe("false");
    expect(document.activeElement).toBe(launcher);
    expect(document.body.style.overflow).not.toBe("hidden");
    expect(layout.style.overflow).not.toBe("hidden");
    expect(
      screen.queryByRole("heading", { name: "어떤 준비를 도와드릴까요?" }),
    ).toBeNull();
    expect(screen.getByLabelText("현재 주소").textContent).toBe(
      "/preparation?categoryId=20",
    );
    fireEvent.click(launcher);
    expect(dialog.getAttribute("data-expanded")).toBe("false");
    act(() => input.focus());
    expect(dialog.getAttribute("data-expanded")).toBe("true");
    expect(screen.getByRole("textbox")).toBe(input);
    expect(document.activeElement).toBe(input);
    await send("다음 준비");
    await screen.findByText("준비 안내 답변");
    fireEvent.change(input, { target: { value: "작성 중인 다음 질문" } });
    fireEvent.click(screen.getByRole("button", { name: "AI 대화 접기" }));
    expect(dialog.getAttribute("data-expanded")).toBe("false");
    expect(screen.queryByRole("log")).toBeNull();
    expect(input.value).toBe("작성 중인 다음 질문");
    await waitFor(() => expect(document.activeElement).toBe(launcher));
    expect(layout.hasAttribute("data-ai-keyboard-open")).toBe(false);
    act(() => input.focus());
    expect(screen.getByRole("log").textContent).toContain("준비 안내 답변");
    fireEvent.click(within(nav).getByRole("link", { name: "캘린더" }));
    await screen.findByRole("heading", { name: "캘린더 화면" });
    expect(screen.queryByRole("dialog", { name: "AI 채팅" })).toBeNull();
    await openChat();
    expect(dialog.getAttribute("data-expanded")).toBe("false");
    expect(screen.getByRole("textbox")).toBe(input);
    expect(input.value).toBe("작성 중인 다음 질문");
    act(() => input.focus());
    expect(screen.getByRole("log").textContent).toContain("준비 안내 답변");
  });
  it.each(["본문 링크", "이동 버튼", "쿼리 변경", "같은 주소"] as const)(
    "모바일의 %s 이동도 AI 기능에서 감지해 숨기고 대화·입력을 보존한다",
    async (navigation) => {
      installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
      render(app());
      await openChat();
      await send("이동 전 질문");
      await screen.findByText("준비 안내 답변");
      const input = screen.getByRole<HTMLTextAreaElement>("textbox");
      fireEvent.change(input, { target: { value: "이동 전 작성 중" } });
      if (navigation === "본문 링크")
        fireEvent.click(screen.getByRole("link", { name: "본문 캘린더 링크" }));
      else if (navigation === "이동 버튼")
        fireEvent.click(screen.getByRole("button", { name: "화면 이동 버튼" }));
      else if (navigation === "쿼리 변경")
        fireEvent.click(screen.getByRole("tab", { name: "웨딩홀" }));
      else
        fireEvent.click(
          screen.getByRole("link", { name: "현재 화면 다시 열기" }),
        );
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "AI 채팅" })).toBeNull(),
      );
      const target =
        navigation === "본문 링크"
          ? "/calendar"
          : navigation === "이동 버튼"
            ? "/checklist"
            : navigation === "쿼리 변경"
              ? "/preparation?categoryId=10"
              : "/preparation?categoryId=20";
      expect(screen.getByLabelText("현재 주소").textContent).toBe(target);
      await openChat();
      expect(screen.getByRole("textbox")).toBe(input);
      expect(input.value).toBe("이동 전 작성 중");
      act(() => input.focus());
      expect(screen.getByRole("log").textContent).toContain("준비 안내 답변");
      expect(mocks.stream).toHaveBeenCalledOnce();
    },
  );
  it("모바일 뒤로·앞으로가기도 AI를 숨기고 예전 주소로 돌아와도 자동으로 다시 열지 않는다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    render(app());
    await openChat();
    const input = screen.getByRole<HTMLTextAreaElement>("textbox");
    fireEvent.change(input, { target: { value: "보존할 입력" } });
    fireEvent.click(screen.getByRole("link", { name: "본문 캘린더 링크" }));
    await screen.findByRole("heading", { name: "캘린더 화면" });
    expect(screen.queryByRole("dialog", { name: "AI 채팅" })).toBeNull();
    await openChat();
    fireEvent.click(screen.getByRole("button", { name: "이전 화면" }));
    await waitFor(() =>
      expect(screen.getByLabelText("현재 주소").textContent).toBe(
        "/preparation?categoryId=20",
      ),
    );
    expect(screen.queryByRole("dialog", { name: "AI 채팅" })).toBeNull();
    await openChat();
    fireEvent.click(screen.getByRole("button", { name: "다음 화면" }));
    await waitFor(() =>
      expect(screen.getByLabelText("현재 주소").textContent).toBe("/calendar"),
    );
    expect(screen.queryByRole("dialog", { name: "AI 채팅" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "이전 화면" }));
    await waitFor(() =>
      expect(screen.getByLabelText("현재 주소").textContent).toBe(
        "/preparation?categoryId=20",
      ),
    );
    expect(screen.queryByRole("dialog", { name: "AI 채팅" })).toBeNull();
    await openChat();
    expect(screen.getByRole("textbox")).toBe(input);
    expect(input.value).toBe("보존할 입력");
  });
  it("입력에 초점을 주지 않은 화면 높이 변경은 키보드로 판정하지 않는다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    vi.stubGlobal("innerHeight", 844);
    const viewport = Object.assign(new EventTarget(), {
      height: 844,
      offsetTop: 0,
      scale: 1,
    });
    vi.stubGlobal("visualViewport", viewport);
    render(app());
    await openChat();
    const dialog = screen.getByRole("dialog", { name: "AI 채팅" });
    const layout = screen.getByRole("region", { name: "서비스 화면" });
    expect(dialog.getAttribute("data-expanded")).toBe("false");
    act(() => {
      viewport.height = 640;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(dialog.getAttribute("data-keyboard-open")).toBe("false");
    expect(layout.hasAttribute("data-ai-keyboard-open")).toBe(false);
    const input = screen.getByRole<HTMLTextAreaElement>("textbox");
    act(() => input.focus());
    act(() => {
      viewport.height = 400;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(layout.hasAttribute("data-ai-keyboard-open")).toBe(true);
    act(() => input.blur());
    expect(layout.hasAttribute("data-ai-keyboard-open")).toBe(false);
  });
  it("키보드 표시 중에만 네비게이션 바를 숨기고 입력창을 보이는 뷰포트 아래에 붙이며 닫으면 정리한다", async () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    vi.stubGlobal("innerHeight", 844);
    const viewport = Object.assign(new EventTarget(), {
      height: 844,
      offsetTop: 0,
      scale: 1,
    });
    vi.stubGlobal("visualViewport", viewport);
    render(app());
    await openChat();
    const dialog = screen.getByRole("dialog", { name: "AI 채팅" });
    const layout = screen.getByRole("region", { name: "서비스 화면" });
    const input = screen.getByRole<HTMLTextAreaElement>("textbox");
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "키보드 입력" } });
    act(() => {
      viewport.height = 420;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(dialog.getAttribute("data-keyboard-open")).toBe("true");
    expect(layout.hasAttribute("data-ai-keyboard-open")).toBe(true);
    expect(dialog.style.getPropertyValue("--global-ai-bottom-inset")).toBe(
      "424px",
    );
    expect(dialog.style.getPropertyValue("--global-ai-viewport-height")).toBe(
      "420px",
    );
    expect(document.activeElement).toBe(input);
    // Layout viewport resizing on Android should not restore the dock prematurely.
    act(() => {
      vi.stubGlobal("innerHeight", 420);
      window.dispatchEvent(new Event("resize"));
    });
    expect(dialog.getAttribute("data-keyboard-open")).toBe("true");
    expect(dialog.style.getPropertyValue("--global-ai-bottom-inset")).toBe(
      "0px",
    );
    vi.stubGlobal("innerHeight", 844);

    act(() => {
      viewport.height = 844;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(layout.hasAttribute("data-ai-keyboard-open")).toBe(false);
    expect(dialog.getAttribute("data-expanded")).toBe("true");
    expect(input.value).toBe("키보드 입력");
    act(() => {
      viewport.height = 420;
      viewport.dispatchEvent(new Event("resize"));
    });
    act(() => {
      viewport.scale = 2;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(layout.hasAttribute("data-ai-keyboard-open")).toBe(false);
    act(() => {
      viewport.scale = 1;
      viewport.dispatchEvent(new Event("resize"));
    });
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "하단 메뉴" })).getByRole(
        "link",
        { name: "체크리스트" },
      ),
    );
    expect(screen.queryByRole("dialog", { name: "AI 채팅" })).toBeNull();
    expect(layout.hasAttribute("data-ai-keyboard-open")).toBe(false);
  });
  it("모바일과 플로팅을 전환해도 대화 DOM·입력·초점을 유지한다", async () => {
    const media = installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, false);
    render(app());
    await openChat();
    const dialog = screen.getByRole("dialog", { name: "AI 채팅" });
    const input = screen.getByRole<HTMLTextAreaElement>("textbox");
    fireEvent.change(input, { target: { value: "작성 중" } });
    act(() => input.focus());
    act(() => media.setMatches(true));
    expect(dialog.getAttribute("data-placement")).toBe("mobile");
    expect(dialog.getAttribute("data-expanded")).toBe("true");
    expect(screen.getByRole("textbox")).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(document.body.style.overflow).not.toBe("hidden");
    expect(input.value).toBe("작성 중");
    act(() => media.setMatches(false));
    expect(dialog.getAttribute("data-placement")).toBe("floating");
    expect(screen.getByRole("textbox")).toBe(input);
    expect(document.activeElement).toBe(input);
  });
  it("4000자 질문은 화면명 때문에 API 제한을 넘기거나 잘리지 않는다", async () => {
    render(app());
    await openChat();
    const question = "가".repeat(4000);
    await send(question);
    await waitFor(() => expect(mocks.stream).toHaveBeenCalledOnce());
    expect(mocks.stream.mock.calls[0][0].message).toBe(question);
  });
  it("다른 화면으로 이동한 뒤 재시도해도 원래 질문의 화면명을 사용한다", async () => {
    mocks.stream.mockRejectedValueOnce(new Error("failed"));
    render(app());
    await openChat();
    await send("다음 할 일");
    await screen.findByRole("button", { name: "다시 시도" });
    await closeChat();
    fireEvent.click(screen.getAllByRole("link", { name: "캘린더" })[0]);
    await openChat();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(mocks.stream).toHaveBeenCalledTimes(2));
    expect(mocks.stream.mock.calls[1][0].message).toBe(
      "[현재 화면: 로드맵]\n다음 할 일",
    );
  });
  it("추천 추가는 페이지와 채팅을 유지하고 결과 보기를 선택했을 때만 이동한다", async () => {
    render(app());
    await openChat();
    await send("추천해줘");
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "웨딩홀 투어" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "1개 추가" }));
    const link = await screen.findByRole("link", { name: "추가한 일 보기" });
    await waitFor(() =>
      expect(link.getAttribute("href")).toBe(
        "/checklist?taskId=checklist-item-501",
      ),
    );
    expect(screen.getByLabelText("현재 주소").textContent).toBe(
      "/preparation?categoryId=20",
    );
    expect(screen.getByRole("dialog", { name: "AI 채팅" })).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: "예식 형태 결정" }),
    ).toBeTruthy();
    fireEvent.click(link);
    await screen.findByRole("heading", { name: "체크리스트 화면" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "AI 채팅" })).toBeNull(),
    );
    expect(screen.getByLabelText("현재 주소").textContent).toBe(
      "/checklist?taskId=checklist-item-501",
    );
    await openChat();
    expect(screen.getByText("준비 안내 답변")).toBeTruthy();
  });
  it("추천 저장 실패는 채팅 안에서 재시도하고 성공하기 전에는 결과 링크를 만들지 않는다", async () => {
    render(app());
    await openChat();
    await send("추천해줘");
    const fallback = mocks.fetch.getMockImplementation()!;
    mocks.fetch.mockImplementation(async (url: string, init?: RequestInit) =>
      url.endsWith("catalog-items") ? json({}, 500) : fallback(url, init),
    );
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "웨딩홀 투어" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "1개 추가" }));
    await screen.findByRole("button", { name: "저장 다시 시도" });
    expect(screen.queryByRole("link", { name: "추가한 일 보기" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "AI 채팅" })).toBeTruthy();
    mocks.fetch.mockImplementation(fallback);
    fireEvent.click(screen.getByRole("button", { name: "저장 다시 시도" }));
    await screen.findByRole("link", { name: "추가한 일 보기" });
  });
  it("모바일과 데스크톱을 오가도 대화와 입력을 유지하고 Escape로 닫으면 플로팅 버튼으로 복귀한다", async () => {
    const media = installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    render(app());
    await openChat();
    await send("준비 질문");
    await screen.findByText("준비 안내 답변");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "모바일에서 작성" },
    });
    act(() => media.setMatches(false));
    expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(
      "모바일에서 작성",
    );
    fireEvent.keyDown(screen.getByRole("dialog", { name: "AI 채팅" }), {
      key: "Escape",
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "AI 채팅" })).toBeNull(),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "AI" }),
      ),
    );
    await openChat();
    expect(screen.getByText("준비 안내 답변")).toBeTruthy();
  });
  it("계정이 변경되면 이전 대화·입력과 열린 상태를 폐기한다", async () => {
    const { rerender } = render(app());
    await openChat();
    await send("이전 계정 질문");
    await screen.findByText("준비 안내 답변");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "이전 입력" },
    });
    mocks.auth = {
      status: "authenticated",
      user: { id: 2, nickname: "새 계정" },
    };
    rerender(app());
    expect(screen.queryByRole("dialog", { name: "AI 채팅" })).toBeNull();
    await openChat();
    expect(screen.queryByText("이전 계정 질문")).toBeNull();
    expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe("");
  });
  it("게스트는 추천 질문 없이 로그인 링크를 제공하고 재열기 후에도 실제 AI 요청을 보내지 않는다", async () => {
    mocks.auth = { status: "guest" };
    render(app());
    await openChat();
    expect(
      await screen.findByRole("link", { name: "로그인하기" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: "웨딩홀을 정한 다음엔 뭘 준비할까?",
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "촬영 전에 준비할 일을 정리해줘" }),
    ).toBeNull();
    expect(screen.queryByText(/현재 화면 참고/)).toBeNull();
    await closeChat();
    fireEvent.click(screen.getAllByRole("link", { name: "캘린더" })[0]);
    await openChat();
    expect(
      screen.getByRole("link", { name: "로그인하기" }).getAttribute("href"),
    ).toBe("/calendar");
    expect(screen.queryByRole("log")).toBeNull();
    expect(mocks.stream).not.toHaveBeenCalled();
  });
});
