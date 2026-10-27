import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MyChecklistProvider } from "../checklist";
import { ServiceLayout } from "../../layouts/ServiceLayout";
import { PreparationRoadmapFeature } from "../preparation";
import { preparationCatalogFixture } from "../preparation/test/fixtures/preparationCatalog.fixture";
import { resetWebAuthSessionForTest } from "../../infrastructure/auth/webSessionManager";
import { AI_CHAT_FULLSCREEN_MEDIA_QUERY as MOBILE_LAYOUT_MEDIA_QUERY } from "./view/GlobalAiChatDialog";
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
vi.mock("../feedback", () => ({ FeedbackFeature: () => null }));
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
      </MemoryRouter>
    </MyChecklistProvider>
  );
}
async function openChat() {
  fireEvent.click(await screen.findByRole("button", { name: "AI 도움" }));
  return screen.findByRole("dialog", { name: "AI 채팅" });
}
async function send(text: string) {
  fireEvent.change(await screen.findByRole("textbox"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "메시지 전송" }));
}
async function closeChat() {
  fireEvent.click(screen.getByRole("button", { name: "AI 채팅 닫기" }));
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

describe("전역 AI 도움", () => {
  it("로드맵은 AI 열 없이 전체 본문을 사용하고 헤더에 하나의 진입점만 제공한다", async () => {
    const { container } = render(app());
    await screen.findByRole("heading", { name: "스드메", level: 1 });
    expect(screen.getAllByRole("button", { name: "AI 도움" })).toHaveLength(1);
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
      screen.getByRole("button", { name: "AI 도움" }),
    );
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "주요 메뉴" })).getByRole(
        "link",
        { name: "체크리스트" },
      ),
    );
    await screen.findByRole("heading", { name: "체크리스트 화면" });
    await openChat();
    expect(screen.getByText("현재 화면 참고 · 체크리스트")).toBeTruthy();
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
    expect(screen.getByText("현재 화면 참고 · 캘린더")).toBeTruthy();
    expect(screen.getAllByText("준비 안내 답변")).toHaveLength(2);
  });
  it("배경의 보조 버튼 클릭은 무시하고 기본 버튼 클릭으로 닫는다", async () => {
    render(app());
    await openChat();
    const dialog = screen.getByRole("dialog", { name: "AI 채팅" });
    const press = (button: number) => {
      fireEvent(
        dialog,
        new MouseEvent("pointerdown", { button, bubbles: true }),
      );
      fireEvent(dialog, new MouseEvent("pointerup", { button, bubbles: true }));
    };
    press(2);
    expect((dialog as HTMLDialogElement).open).toBe(true);
    press(0);
    await waitFor(() => expect((dialog as HTMLDialogElement).open).toBe(false));
  });
  it("side와 fullscreen을 전환해도 대화 DOM과 입력을 유지한다", async () => {
    const media = installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, false);
    render(app());
    await openChat();
    const dialog = screen.getByRole("dialog", { name: "AI 채팅" });
    const input = screen.getByRole<HTMLTextAreaElement>("textbox");
    fireEvent.change(input, { target: { value: "작성 중" } });
    expect(dialog.getAttribute("data-placement")).toBe("side");
    act(() => media.setMatches(true));
    expect(dialog.getAttribute("data-placement")).toBe("fullscreen");
    expect(screen.getByRole("textbox")).toBe(input);
    expect(input.value).toBe("작성 중");
    await closeChat();
    await openChat();
    expect(screen.getByRole("textbox")).toBe(input);
    expect(input.value).toBe("작성 중");
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
      await screen.findByRole("button", { name: "현재 추천: 웨딩홀 투어" }),
    );
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
      screen.getByRole("button", { name: "현재 추천: 예식 형태 결정" }),
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
      await screen.findByRole("button", { name: "현재 추천: 웨딩홀 투어" }),
    );
    await screen.findByRole("button", { name: "저장 다시 시도" });
    expect(screen.queryByRole("link", { name: "추가한 일 보기" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "AI 채팅" })).toBeTruthy();
    mocks.fetch.mockImplementation(fallback);
    fireEvent.click(screen.getByRole("button", { name: "저장 다시 시도" }));
    await screen.findByRole("link", { name: "추가한 일 보기" });
  });
  it("모바일과 데스크톱을 오가도 대화와 입력을 유지하고 Escape로 닫으면 헤더로 복귀한다", async () => {
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
        screen.getByRole("button", { name: "AI 도움" }),
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
  it("게스트의 예시 대화는 닫았다 열어도 남아 있고 실제 AI 요청은 보내지 않는다", async () => {
    mocks.auth = { status: "guest" };
    render(app());
    await openChat();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "웨딩홀을 정한 다음엔 뭘 준비할까?",
      }),
    );
    await screen.findByRole("log");
    await closeChat();
    fireEvent.click(screen.getAllByRole("link", { name: "캘린더" })[0]);
    await openChat();
    expect(screen.getByRole("log").textContent).toContain(
      "웨딩홀을 정한 다음엔 뭘 준비할까?",
    );
    expect(mocks.stream).not.toHaveBeenCalled();
  });
});
