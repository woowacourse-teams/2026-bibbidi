import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "../../test/memoryNavigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MyChecklistProvider } from "../checklist";
import { ServiceLayout } from "../../layouts/ServiceLayout";
import { AiChatPage } from "../../screens/AiChatPage";
import { preparationCatalogFixture } from "../preparation/test/fixtures/preparationCatalog.fixture";
import { resetWebAuthSessionForTest } from "../../infrastructure/auth/webSessionManager";
import { MOBILE_LAYOUT_MEDIA_QUERY } from "../../shared/responsive";
import { installMatchMedia } from "../../test/matchMedia";
import type { AuthState } from "../auth/model/auth";
import type { streamAiChat } from "./api/streamAiChat";

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
const conversationId = "d67a9265-3f45-4d7f-99f1-b5823054c8d9";
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
function Location() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output aria-label="현재 주소">
        {location.pathname}
        {location.search}
      </output>
      <button type="button" onClick={() => navigate(-1)}>
        이전 화면
      </button>
      <button type="button" onClick={() => navigate(1)}>
        다음 화면
      </button>
    </>
  );
}
function app(initial = "/preparation") {
  return (
    <MyChecklistProvider sessionKey="ai-tabs">
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route
            element={
              <ServiceLayout>
                <Outlet />
              </ServiceLayout>
            }
          >
            <Route path="/preparation" element={<h1>로드맵 화면</h1>} />
            <Route path="/checklist" element={<h1>체크리스트 화면</h1>} />
            <Route path="/calendar" element={<h1>캘린더 화면</h1>} />
            <Route path="/ai-chat" element={<AiChatPage />} />
          </Route>
        </Routes>
        <Location />
      </MemoryRouter>
    </MyChecklistProvider>
  );
}
function navigateTab(name: string, mobile = false) {
  fireEvent.click(
    within(
      screen.getByRole("navigation", {
        name: mobile ? "하단 메뉴" : "주요 메뉴",
      }),
    ).getByRole("link", { name }),
  );
}
async function send(text = "무엇부터 준비할까?") {
  fireEvent.change(
    screen.getByRole("textbox", { name: "AI에게 보낼 메시지" }),
    { target: { value: text } },
  );
  fireEvent.click(screen.getByRole("button", { name: "메시지 전송" }));
  await screen.findByText("준비 안내 답변");
}
let items: unknown[];
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.auth = { status: "authenticated", user: { id: 1, nickname: "비비디" } };
  items = [];
  mocks.catalog.mockResolvedValue(preparationCatalogFixture);
  mocks.stream.mockImplementation(async (_request, receiver) => {
    receiver.onConversation(conversationId);
    receiver.onDelta("준비 안내 답변");
  });
  mocks.fetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/api/checklists/me") return json({ id: 1, items });
    if (url === "/api/checklists/me/catalog-items") {
      const catalogItemId = JSON.parse(init!.body as string)[0];
      const item = {
        id: 501,
        catalogItemId,
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
  installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, false);
});
afterEach(() => {
  resetWebAuthSessionForTest();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AI 챗 독립 탭", () => {
  it.each([false, true])(
    "모바일 여부 %s에서 AI 챗 링크로 독립 경로에 이동한다",
    async (mobile) => {
      installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, mobile);
      render(app());
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(screen.queryByRole("button", { name: "AI" })).toBeNull();
      navigateTab("AI 챗", mobile);
      expect(await screen.findByRole("main", { name: "AI 챗" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "비비디 홈" })).toBeTruthy();
      expect(
        screen.getByRole("status", { name: "현재 주소" }).textContent,
      ).toBe("/ai-chat");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(
        screen.getAllByRole("heading", { name: "AI 챗", level: 1 }),
      ).toHaveLength(1);
      const link = within(
        screen.getByRole("navigation", {
          name: mobile ? "하단 메뉴" : "주요 메뉴",
        }),
      ).getByRole("link", { name: "AI 챗" });
      expect(link.getAttribute("aria-current")).toBe("page");
      expect(mocks.stream).not.toHaveBeenCalled();
    },
  );
  it.each([false, true])(
    "모바일 여부 %s에서 다른 탭과 뒤로·앞으로 이동 후 대화 ID와 초안을 유지한다",
    async (mobile) => {
      installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, mobile);
      render(app("/ai-chat"));
      await send("첫 질문");
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "작성 중 질문" },
      });
      navigateTab("캘린더", mobile);
      expect(screen.queryByRole("main", { name: "AI 챗" })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "이전 화면" }));
      expect(await screen.findByText("준비 안내 답변")).toBeTruthy();
      expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(
        "작성 중 질문",
      );
      fireEvent.click(screen.getByRole("button", { name: "다음 화면" }));
      navigateTab("AI 챗", mobile);
      fireEvent.click(screen.getByRole("button", { name: "메시지 전송" }));
      await waitFor(() => expect(mocks.stream).toHaveBeenCalledTimes(2));
      expect(mocks.stream.mock.calls[1][0]).toEqual({
        message: "작성 중 질문",
        conversationId,
      });
    },
  );
  it("다른 탭에서 스트리밍을 계속 받고 돌아오면 이어진 답변을 보여준다", async () => {
    let receiver!: Parameters<typeof streamAiChat>[1];
    let signal!: AbortSignal;
    let finish!: () => void;
    mocks.stream.mockImplementationOnce((_request, target, requestSignal) => {
      receiver = target;
      signal = requestSignal;
      receiver.onConversation(conversationId);
      receiver.onDelta("앞부분 ");
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    });
    render(app("/ai-chat"));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "질문" },
    });
    fireEvent.click(screen.getByRole("button", { name: "메시지 전송" }));
    navigateTab("체크리스트");
    expect(signal.aborted).toBe(false);
    await act(async () => {
      receiver.onDelta("뒷부분");
      finish();
    });
    navigateTab("AI 챗");
    expect(await screen.findByText("앞부분 뒷부분")).toBeTruthy();
  });
  it("추천 저장 후 결과 보기를 눌러야 추가한 항목으로 이동한다", async () => {
    mocks.stream.mockImplementationOnce(async (_request, receiver) => {
      receiver.onConversation(conversationId);
      receiver.onDelta("준비 안내 답변");
      receiver.onRecommendations?.(["101"]);
    });
    render(app("/ai-chat"));
    await send();
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "웨딩홀 투어" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "1개 추가" }));
    await screen.findByText("추가한 웨딩홀 투어 추가 완료");
    expect(screen.getByRole("main", { name: "AI 챗" })).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "추가한 일 보기" }));
    expect(
      await screen.findByRole("heading", { name: "체크리스트 화면" }),
    ).toBeTruthy();
    expect(screen.getByRole("status", { name: "현재 주소" }).textContent).toBe(
      "/checklist?taskId=checklist-item-501",
    );
    navigateTab("AI 챗");
    expect(await screen.findByText("준비 안내 답변")).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "웨딩홀 투어" })).toBeNull();
  });
  it("계정이 바뀌면 이전 대화와 초안을 제거한다", async () => {
    const { rerender } = render(app("/ai-chat"));
    await send();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "개인 초안" },
    });
    mocks.auth = {
      status: "authenticated",
      user: { id: 2, nickname: "다른 사용자" },
    };
    rerender(app("/ai-chat"));
    expect(screen.queryByText("준비 안내 답변")).toBeNull();
    expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe("");
  });
  it("비로그인 사용자도 직접 접근할 수 있고 로그인 전에는 전송할 수 없다", () => {
    mocks.auth = { status: "guest" };
    render(app("/ai-chat"));
    expect(screen.getByRole("link", { name: "로그인하기" })).toBeTruthy();
    expect(screen.getByRole<HTMLTextAreaElement>("textbox").disabled).toBe(
      true,
    );
    expect(mocks.stream).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("모바일 키보드가 열린 동안 하단 메뉴를 숨기고 탭을 떠나면 정리한다", () => {
    installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
    vi.stubGlobal("innerHeight", 844);
    const viewport = Object.assign(new EventTarget(), {
      height: 844,
      offsetTop: 0,
      scale: 1,
    });
    vi.stubGlobal("visualViewport", viewport);
    render(app("/ai-chat"));
    act(() => screen.getByRole<HTMLTextAreaElement>("textbox").focus());
    act(() => {
      viewport.height = 400;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(
      screen
        .getByRole("region", { name: "서비스 화면" })
        .hasAttribute("data-ai-keyboard-open"),
    ).toBe(true);
    expect(
      screen
        .getByRole("main", { name: "AI 챗" })
        .style.getPropertyValue("--ai-page-viewport-height"),
    ).toBe("400px");
    navigateTab("캘린더", true);
    expect(
      screen
        .getByRole("region", { name: "서비스 화면" })
        .hasAttribute("data-ai-keyboard-open"),
    ).toBe(false);
  });
});
