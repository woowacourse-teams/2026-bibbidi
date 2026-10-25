import { MOBILE_LAYOUT_MEDIA_QUERY } from "../../shared/responsive";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect, useState } from "react";

import { AiChatFeature } from "./AiChatFeature";
import type { streamAiChat } from "./api/streamAiChat";
import {
  MyChecklistProvider,
  useMyChecklistQueryRepository,
  useMyChecklistRevision,
} from "../checklist";
import { preparationCatalogFixture } from "../preparation/test/fixtures/preparationCatalog.fixture";
import { resetWebAuthSessionForTest } from "../../infrastructure/auth/webSessionManager";
import { installMatchMedia } from "../../test/matchMedia";
import { installDialogMock } from "../../test/dialog";
import { AiChatRecommendations } from "./view/AiChatRecommendations";

const mocks = vi.hoisted(() => ({
  stream: vi.fn(),
  catalog: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("./api/streamAiChat", async (original) => ({
  ...(await original<typeof import("./api/streamAiChat")>()),
  streamAiChat: mocks.stream,
}));
vi.mock("../catalog", () => ({
  catalogRepository: { getCatalog: mocks.catalog },
}));

const authRequired = vi.fn();
let restoreDialog: (() => void) | undefined;
const captureDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "setPointerCapture",
);

function ChecklistObserver() {
  const query = useMyChecklistQueryRepository();
  const revision = useMyChecklistRevision();
  const [titles, setTitles] = useState("");
  useEffect(() => {
    if (!revision) return;
    const controller = new AbortController();
    void query.getChecklist(controller.signal).then((result) => {
      if (!controller.signal.aborted)
        setTitles(result.items.map((item) => item.title).join(", "));
    });
    return () => controller.abort();
  }, [query, revision]);
  return <output aria-label="공유 로드맵 항목">{titles}</output>;
}

function chat(observe = false) {
  return (
    <MyChecklistProvider sessionKey="recommendation-test">
      <AiChatFeature isAuthenticated onAuthenticationRequired={authRequired} />
      {observe ? <ChecklistObserver /> : null}
    </MyChecklistProvider>
  );
}
async function send() {
  fireEvent.change(await screen.findByRole("textbox"), {
    target: { value: "추천해줘" },
  });
  fireEvent.click(screen.getByRole("button", { name: "메시지 전송" }));
}
const currentCard = () =>
  screen.getByRole<HTMLButtonElement>("button", { name: /^현재 추천:/ });
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
const addedItem = {
  id: 1,
  catalogItemId: 101,
  categoryId: 10,
  status: "prev",
  title: "웨딩홀 투어",
  createdAt: "2026-10-15T12:00:00",
};
const postCalls = () =>
  mocks.fetch.mock.calls.filter(([, init]) => init?.method === "POST");

function mockChatScrollHeight() {
  vi.spyOn(Element.prototype, "scrollHeight", "get").mockImplementation(
    function (this: Element) {
      return this.getAttribute("role") === "log"
        ? 600 + this.querySelectorAll('[aria-label="추천 할 일"]').length * 400
        : 0;
    },
  );
}

function mockMobileDialog() {
  const media = installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, true);
  restoreDialog = installDialogMock();
  return media;
}

function pendingCatalog() {
  let finish!: (catalog: typeof preparationCatalogFixture) => void;
  mocks.catalog.mockImplementationOnce(
    () =>
      new Promise<typeof preparationCatalogFixture>((resolve) => {
        finish = resolve;
      }),
  );
  return async () => {
    await waitFor(() => expect(mocks.catalog).toHaveBeenCalledOnce());
    await act(async () => finish(preparationCatalogFixture));
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, false);
  mocks.catalog.mockResolvedValue(preparationCatalogFixture);
  mocks.stream.mockImplementation(
    async (_request, receiver: Parameters<typeof streamAiChat>[1]) => {
      receiver.onConversation("d67a9265-3f45-4d7f-99f1-b5823054c8d9");
      receiver.onDelta("마음에 드는 일을 담아보세요.");
      receiver.onRecommendations?.(["101", "201", "301"]);
    },
  );
  mocks.fetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/api/checklists/me" && init?.method === "GET")
      return json({ id: 1, items: [] });
    if (url === "/api/checklists/me/catalog-items")
      return json({ items: [addedItem] });
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  cleanup();
  restoreDialog?.();
  restoreDialog = undefined;
  resetWebAuthSessionForTest();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (captureDescriptor)
    Object.defineProperty(
      HTMLElement.prototype,
      "setPointerCapture",
      captureDescriptor,
    );
  else delete (HTMLElement.prototype as Partial<HTMLElement>).setPointerCapture;
});

describe("AI 추천 카드 연결", () => {
  it("첫 추천 데이터가 늦게 도착하면 카드 아래까지 내리고 다음 추천도 하단에 표시한다", async () => {
    mockChatScrollHeight();
    const finishCatalog = pendingCatalog();
    render(chat());
    await send();
    await screen.findByText("추천 카드를 불러오고 있어요.");
    const log = screen.getByRole("log");
    expect(log.scrollTop).toBe(600);

    await finishCatalog();
    expect(currentCard()).toBeTruthy();
    expect(log.scrollTop).toBe(1000);

    await send();
    await waitFor(() =>
      expect(
        screen.getAllByRole("region", { name: "추천 할 일" }),
      ).toHaveLength(2),
    );
    await waitFor(() => expect(log.scrollTop).toBe(1400));
    expect(mocks.catalog).toHaveBeenCalledOnce();
  });

  it("닫힌 모바일에서 첫 추천이 도착하면 다시 열 때 하단으로 내리고 이후에는 읽던 위치를 복원한다", async () => {
    mockMobileDialog();
    mockChatScrollHeight();
    const finishCatalog = pendingCatalog();
    render(chat());
    fireEvent.click(screen.getByRole("button", { name: "AI와 대화하기" }));
    await send();
    await screen.findByText("추천 카드를 불러오고 있어요.");
    const log = screen.getByRole("log");
    expect(log.scrollTop).toBe(600);
    fireEvent.click(screen.getByRole("button", { name: "AI 채팅 닫기" }));

    await finishCatalog();
    expect(log.querySelector('[aria-label="추천 할 일"]')).toBeTruthy();
    expect(log.scrollTop).toBe(600);
    fireEvent.click(screen.getByRole("button", { name: "AI와 대화하기" }));
    expect(log.scrollTop).toBe(1000);

    log.scrollTop = 250;
    fireEvent.scroll(log);
    fireEvent.click(screen.getByRole("button", { name: "AI 채팅 닫기" }));
    log.scrollTop = 0;
    fireEvent.scroll(log);
    fireEvent.click(screen.getByRole("button", { name: "AI와 대화하기" }));
    expect(log.scrollTop).toBe(250);
  });

  it("완료 전에는 카드를 숨기고 완료 후 서버 순서와 카탈로그 정보를 표시한다", async () => {
    let finish!: () => void;
    mocks.stream.mockImplementationOnce(
      async (_request, receiver: Parameters<typeof streamAiChat>[1]) => {
        receiver.onDelta("추천 답변");
        receiver.onRecommendations?.(["201", "999999", "101"]);
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
      },
    );
    render(chat());
    await send();
    expect(screen.queryByRole("region", { name: "추천 할 일" })).toBeNull();
    expect(mocks.catalog).not.toHaveBeenCalled();
    await act(async () => finish());
    await screen.findByRole("button", { name: "현재 추천: 예식 형태 결정" });
    expect(
      within(currentCard()).getByText("예식 형태·식순·입장 방식 결정"),
    ).toBeTruthy();
    expect(screen.getByText("1 / 2")).toBeTruthy();
    expect(mocks.catalog).toHaveBeenCalledOnce();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("미완료 답변에서는 추천을 숨기고 재시도 답변의 추천만 보여준다", async () => {
    mocks.stream.mockImplementationOnce(
      async (_request, receiver: Parameters<typeof streamAiChat>[1]) => {
        receiver.onDelta("중간 답변");
        receiver.onRecommendations?.(["201"]);
        throw new Error("failure");
      },
    );
    render(chat());
    await send();
    await screen.findByText("미완료 답변");
    expect(screen.queryByRole("region", { name: "추천 할 일" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByRole("button", { name: "현재 추천: 웨딩홀 투어" });
    expect(screen.queryByText("미완료 답변")).toBeNull();
  });

  it("카탈로그 조회만 재시도하고 텍스트와 AI 호출 횟수를 유지한다", async () => {
    mocks.catalog.mockRejectedValueOnce(new Error("network"));
    render(chat());
    await send();
    await screen.findByRole("button", { name: "카드 다시 불러오기" });
    expect(screen.getByText("마음에 드는 일을 담아보세요.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "카드 다시 불러오기" }));
    await screen.findByRole("button", { name: "현재 추천: 웨딩홀 투어" });
    expect(mocks.stream).toHaveBeenCalledOnce();
  });

  it("옆 카드 선택과 키보드 이동·스킵을 지원하고 모두 처리하면 완료 안내를 남긴다", async () => {
    render(chat());
    await send();
    fireEvent.click(
      await screen.findByRole("button", { name: "다음 추천: 예식 형태 결정" }),
    );
    expect(currentCard().getAttribute("aria-label")).toContain(
      "예식 형태 결정",
    );
    fireEvent.keyDown(currentCard(), { key: "Delete" });
    expect(currentCard().getAttribute("aria-label")).toContain("사회자 섭외");
    fireEvent.keyDown(currentCard(), { key: "ArrowRight" });
    expect(currentCard().getAttribute("aria-label")).toContain("웨딩홀 투어");
    fireEvent.keyDown(currentCard(), { key: "Delete" });
    fireEvent.keyDown(currentCard(), { key: "Delete" });
    const complete = screen.getByRole("status");
    expect(within(complete).getByText("Bibbidi")).toBeTruthy();
    expect(
      within(complete).getByText(
        "추천을 모두 확인했어요. 더 궁금한 준비가 있나요?",
      ),
    ).toBeTruthy();
    expect(document.activeElement).toBe(complete);
    expect(mocks.fetch).not.toHaveBeenCalled();
    await send();
    await screen.findByRole("button", { name: "현재 추천: 웨딩홀 투어" });
  });

  it("옆 카드를 바꿔도 현재 카드의 키보드 조작 대상과 읽던 위치를 유지한다", async () => {
    mockChatScrollHeight();
    render(chat());
    await send();
    const card = await screen.findByRole("button", {
      name: "현재 추천: 웨딩홀 투어",
    });
    const log = screen.getByRole("log");
    await waitFor(() => expect(log.scrollTop).toBe(1000));
    log.scrollTop = 120;
    fireEvent.scroll(log);
    card.focus({ preventScroll: true });

    fireEvent.click(
      screen.getByRole("button", { name: "다음 추천: 예식 형태 결정" }),
    );

    expect(currentCard().getAttribute("aria-label")).toContain(
      "예식 형태 결정",
    );
    expect(document.activeElement).toBe(currentCard());
    expect(log.scrollTop).toBe(120);
  });

  it.each(["ArrowRight", "Delete", "Enter"])(
    "%s로 새 추천에 포커스를 옮겨도 대화 스크롤을 움직이지 않는다",
    async (key) => {
      mockChatScrollHeight();
      render(chat());
      await send();
      const card = await screen.findByRole("button", {
        name: "현재 추천: 웨딩홀 투어",
      });
      const log = screen.getByRole("log");
      await waitFor(() => expect(log.scrollTop).toBe(1000));
      const focus = HTMLElement.prototype.focus;
      vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (
        this: HTMLElement,
        options?: FocusOptions,
      ) {
        if (this.closest(".ai-chat__log") && !options?.preventScroll)
          log.scrollTop = 0;
        focus.call(this, options);
      });
      log.scrollTop = 120;
      fireEvent.scroll(log);

      if (key === "Enter") fireEvent.click(card, { detail: 0 });
      else fireEvent.keyDown(card, { key });

      await screen.findByRole("button", { name: "현재 추천: 예식 형태 결정" });
      await waitFor(() => expect(document.activeElement).toBe(currentCard()));
      expect(log.scrollTop).toBe(120);

      while (screen.queryByRole("button", { name: /^현재 추천:/ }))
        fireEvent.keyDown(currentCard(), { key: "Delete" });
      expect(document.activeElement).toBe(screen.getByRole("status"));
      expect(log.scrollTop).toBe(120);
    },
  );

  it("프론트가 저장 API를 한 번만 호출하고 성공 전에는 현재 카드를 유지한다", async () => {
    let finish!: (response: Response) => void;
    mocks.fetch.mockImplementation(async (url: string) =>
      url.endsWith("catalog-items")
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : json({ id: 1, items: [] }),
    );
    render(chat(true));
    await send();
    await screen.findByRole("button", { name: "현재 추천: 웨딩홀 투어" });
    fireEvent.click(currentCard());
    fireEvent.click(currentCard());
    await waitFor(() => expect(postCalls()).toHaveLength(1));
    expect(currentCard().disabled).toBe(true);
    expect(screen.getByText("저장 중…")).toBeTruthy();
    expect(postCalls()[0][0]).toBe("/api/checklists/me/catalog-items");
    expect(JSON.parse(postCalls()[0][1].body)).toEqual([101]);
    await act(async () => finish(json({ items: [addedItem] })));
    expect(currentCard().getAttribute("aria-label")).toContain(
      "예식 형태 결정",
    );
    await waitFor(() =>
      expect(screen.getByLabelText("공유 로드맵 항목").textContent).toBe(
        "웨딩홀 투어",
      ),
    );
    expect(
      mocks.fetch.mock.calls.filter(([, init]) => init?.method === "GET"),
    ).toHaveLength(1);
    expect(mocks.stream).toHaveBeenCalledOnce();
    await send();
    await waitFor(() =>
      expect(
        screen.getAllByRole("region", { name: "추천 할 일" }),
      ).toHaveLength(2),
    );
    expect(
      screen.queryByRole("button", { name: "현재 추천: 웨딩홀 투어" }),
    ).toBeNull();
  });

  it("저장 실패 후 현재 카드를 복구하고 저장 API만 재시도한다", async () => {
    let fail = true;
    mocks.fetch.mockImplementation(async (url: string) =>
      url.endsWith("catalog-items")
        ? fail
          ? json({}, 500)
          : json({ items: [addedItem] })
        : json({ id: 1, items: [] }),
    );
    render(chat());
    await send();
    fireEvent.click(
      await screen.findByRole("button", { name: "현재 추천: 웨딩홀 투어" }),
    );
    await screen.findByRole("button", { name: "저장 다시 시도" });
    expect(currentCard().disabled).toBe(false);
    expect(currentCard().getAttribute("aria-label")).toContain("웨딩홀 투어");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "저장 다시 시도" }));
    await screen.findByRole("button", { name: "현재 추천: 예식 형태 결정" });
    expect(postCalls()).toHaveLength(2);
    expect(mocks.stream).toHaveBeenCalledOnce();
  });

  it("이미 저장된 항목은 추가 API를 호출하지 않고 다음으로 이동한다", async () => {
    mocks.fetch.mockResolvedValue(
      json({ id: 1, items: [{ ...addedItem, appointments: [] }] }),
    );
    render(chat());
    await send();
    fireEvent.click(
      await screen.findByRole("button", { name: "현재 추천: 웨딩홀 투어" }),
    );
    await screen.findByRole("button", { name: "현재 추천: 예식 형태 결정" });
    expect(postCalls()).toHaveLength(0);
  });

  it("다른 답변에 같은 카드가 있어도 동시에 한 번만 저장한다", async () => {
    let finish!: (response: Response) => void;
    mocks.fetch.mockImplementation(async (url: string) =>
      url.endsWith("catalog-items")
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : json({ id: 1, items: [] }),
    );
    render(chat());
    await send();
    await screen.findByRole("button", { name: "현재 추천: 웨딩홀 투어" });
    await send();
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: "현재 추천: 웨딩홀 투어" }),
      ).toHaveLength(2),
    );
    const cards = screen.getAllByRole("button", {
      name: "현재 추천: 웨딩홀 투어",
    });
    fireEvent.click(cards[0]);
    fireEvent.click(cards[1]);
    await waitFor(() => expect(postCalls()).toHaveLength(1));
    await act(async () => finish(json({ items: [addedItem] })));
    expect(
      screen.queryByRole("button", { name: "현재 추천: 웨딩홀 투어" }),
    ).toBeNull();
  });

  it("서버 중복 응답은 재시도 대신 추천에서 제외하고 공유 목록을 갱신한다", async () => {
    let reads = 0;
    mocks.fetch.mockImplementation(async (url: string) =>
      url.endsWith("catalog-items")
        ? json({ errorCode: 403, message: "duplicate" }, 409)
        : json({
            id: 1,
            items: reads++ ? [{ ...addedItem, appointments: [] }] : [],
          }),
    );
    render(chat());
    await send();
    fireEvent.click(
      await screen.findByRole("button", { name: "현재 추천: 웨딩홀 투어" }),
    );
    await screen.findByRole("button", { name: "현재 추천: 예식 형태 결정" });
    await waitFor(() => expect(reads).toBe(2));
    expect(screen.queryByRole("button", { name: "저장 다시 시도" })).toBeNull();
    expect(postCalls()).toHaveLength(1);
  });

  it("중복 저장 뒤 목록 갱신이 실패하면 카드를 유지하고 조회만 재시도한다", async () => {
    let reads = 0;
    mocks.fetch.mockImplementation(async (url: string) => {
      if (url.endsWith("catalog-items"))
        return json({ errorCode: 403, message: "duplicate" }, 409);
      reads += 1;
      if (reads === 2) return json({}, 500);
      return json({
        id: 1,
        items: reads > 2 ? [{ ...addedItem, appointments: [] }] : [],
      });
    });
    render(chat());
    await send();
    fireEvent.click(
      await screen.findByRole("button", { name: "현재 추천: 웨딩홀 투어" }),
    );
    await screen.findByRole("button", { name: "저장 다시 시도" });
    expect(currentCard().getAttribute("aria-label")).toContain("웨딩홀 투어");
    expect(currentCard().disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "저장 다시 시도" }));
    await screen.findByRole("button", { name: "현재 추천: 예식 형태 결정" });
    expect(postCalls()).toHaveLength(1);
    expect(reads).toBe(3);
    expect(mocks.stream).toHaveBeenCalledOnce();
  });

  it("중복 저장 뒤 목록 갱신의 인증 만료도 인증 흐름으로 전달한다", async () => {
    let reads = 0;
    mocks.fetch.mockImplementation(async (url: string) => {
      if (url.endsWith("catalog-items"))
        return json({ errorCode: 403, message: "duplicate" }, 409);
      return reads++
        ? json({ errorCode: 201, message: "login" }, 401)
        : json({ id: 1, items: [] });
    });
    render(chat());
    await send();
    fireEvent.click(
      await screen.findByRole("button", { name: "현재 추천: 웨딩홀 투어" }),
    );
    await screen.findByText(
      "로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요.",
    );
    expect(authRequired).toHaveBeenCalledOnce();
    expect(currentCard().getAttribute("aria-label")).toContain("웨딩홀 투어");
  });

  it("화면을 떠나면 저장 요청을 취소하고 늦은 결과를 새 대화에 반영하지 않는다", async () => {
    let finish!: (response: Response) => void;
    mocks.fetch.mockImplementation(async (url: string) =>
      url.endsWith("catalog-items")
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : json({ id: 1, items: [] }),
    );
    const view = render(chat());
    await send();
    fireEvent.click(
      await screen.findByRole("button", { name: "현재 추천: 웨딩홀 투어" }),
    );
    await waitFor(() => expect(postCalls()).toHaveLength(1));
    const signal = postCalls()[0][1].signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    render(chat());
    await act(async () => finish(json({ items: [addedItem] })));
    expect(screen.queryByRole("region", { name: "추천 할 일" })).toBeNull();
    expect(
      await screen.findByRole("heading", { name: "어떤 준비를 도와드릴까요?" }),
    ).toBeTruthy();
  });

  it("저장 인증 만료는 카드를 유지하고 인증 상태를 다시 확인한다", async () => {
    mocks.fetch.mockResolvedValue(
      json({ errorCode: 201, message: "login" }, 401),
    );
    render(chat());
    await send();
    fireEvent.click(
      await screen.findByRole("button", { name: "현재 추천: 웨딩홀 투어" }),
    );
    await screen.findByText(
      "로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요.",
    );
    expect(authRequired).toHaveBeenCalledOnce();
    expect(currentCard().disabled).toBe(false);
  });

  it("모바일 닫기·재열기와 PC 전환에서 선택·스킵 상태를 유지한다", async () => {
    const media = mockMobileDialog();
    render(chat());
    fireEvent.click(screen.getByRole("button", { name: "AI와 대화하기" }));
    await send();
    fireEvent.keyDown(
      await screen.findByRole("button", { name: "현재 추천: 웨딩홀 투어" }),
      { key: "Delete" },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "다음 추천: 사회자 섭외" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "AI 채팅 닫기" }));
    fireEvent.click(screen.getByRole("button", { name: "AI와 대화하기" }));
    expect(currentCard().getAttribute("aria-label")).toContain("사회자 섭외");
    act(() => media.setMatches(false));
    expect(currentCard().getAttribute("aria-label")).toContain("사회자 섭외");
    expect(screen.getByText("2 / 2")).toBeTruthy();
  });
});

describe("추천 카드 포인터 제스처", () => {
  it.each(["pointerCancel", "lostPointerCapture", "Escape", "unmount"])(
    "%s 시 카드·안내 레이어와 채팅 스크롤을 복구한다",
    (ending) => {
      class TestPointerEvent extends MouseEvent {
        pointerId = 1;
        isPrimary = true;
      }
      vi.stubGlobal("PointerEvent", TestPointerEvent);
      Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
        configurable: true,
        value: vi.fn(),
      });
      const view = render(
        <div
          className="ai-chat__log"
          style={{ overflowY: "auto", overflowAnchor: "auto" }}
        >
          <AiChatRecommendations
            tasks={[{ id: "101", title: "추천", stepTitle: "단계", order: 1 }]}
            status="ready"
            saving={false}
            onSelect={vi.fn()}
            onSkip={vi.fn()}
            onAdd={vi.fn()}
            onRetry={vi.fn()}
          />
        </div>,
      );
      const card = currentCard();
      const layer = card.closest("section")!;
      const slot = layer.parentElement!;
      const log = slot.parentElement!;
      log.scrollTop = 120;
      const show = vi.fn();
      const hide = vi.fn();
      Object.defineProperties(layer, {
        showPopover: { configurable: true, value: show },
        hidePopover: { configurable: true, value: hide },
      });
      vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
        left: 20,
        top: 100,
        width: 280,
        height: 272,
      } as DOMRect);
      vi.spyOn(layer, "getBoundingClientRect").mockReturnValue({
        left: 10,
        top: 40,
        width: 300,
        height: 420,
      } as DOMRect);
      fireEvent.pointerDown(card, { button: 0, clientX: 150, clientY: 100 });
      expect(show).toHaveBeenCalledOnce();
      expect(slot.style.height).toBe("420px");
      expect(layer.style.getPropertyValue("--recommendation-layer-top")).toBe(
        "40px",
      );
      expect(log.style.overflowY).toBe("hidden");
      log.scrollTop = 200;
      fireEvent.scroll(log);
      expect(log.scrollTop).toBe(120);
      if (ending === "Escape") fireEvent.keyDown(card, { key: "Escape" });
      else if (ending === "unmount") view.unmount();
      else if (ending === "pointerCancel") fireEvent.pointerCancel(card);
      else fireEvent.lostPointerCapture(card);
      if (ending !== "unmount") expect(hide).toHaveBeenCalledOnce();
      expect(log.style.overflowY).toBe("auto");
      expect(log.style.overflowAnchor).toBe("auto");
      expect(log.scrollTop).toBe(120);
      if (ending !== "unmount") {
        expect(slot.style.height).toBe("");
        expect(layer.className).not.toContain("pressed");
      }
    },
  );

  it("위아래로 벗어나도 좌우 드래그를 유지하고 세로 이동만으로는 처리하지 않는다", () => {
    class TestPointerEvent extends MouseEvent {
      pointerId = 1;
      isPrimary = true;
    }
    vi.stubGlobal("PointerEvent", TestPointerEvent);
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
    const skip = vi.fn();
    const add = vi.fn();
    render(
      <AiChatRecommendations
        tasks={[{ id: "101", title: "추천", stepTitle: "단계", order: 1 }]}
        status="ready"
        saving={false}
        onSelect={vi.fn()}
        onSkip={skip}
        onAdd={add}
        onRetry={vi.fn()}
      />,
    );
    const card = currentCard();
    const down = () =>
      fireEvent.pointerDown(card, { button: 0, clientX: 150, clientY: 100 });
    down();
    fireEvent.pointerUp(card, { clientX: 180, clientY: 100 });
    down();
    fireEvent.pointerMove(card, { clientX: 155, clientY: 180 });
    expect(card.closest("section")?.className).toContain("pressed");
    expect(card.style.getPropertyValue("--recommendation-x")).toBe("5px");
    fireEvent.pointerUp(card, { clientX: 155, clientY: 500 });
    down();
    fireEvent.pointerCancel(card);
    fireEvent.pointerUp(card, { clientX: 250, clientY: 100 });
    expect(skip).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    down();
    fireEvent.pointerMove(card, { clientX: 50, clientY: 400 });
    expect(screen.getByText("손을 떼면 이 추천을 스킵해요")).toBeTruthy();
    fireEvent.pointerUp(card, { clientX: 50, clientY: 900 });
    expect(skip).toHaveBeenCalledExactlyOnceWith("101");
    down();
    fireEvent.pointerMove(card, { clientX: 250, clientY: -200 });
    fireEvent.pointerUp(card, { clientX: 250, clientY: -500 });
    expect(add).toHaveBeenCalledExactlyOnceWith("101");
    expect(card.closest("section")?.className).not.toContain("pressed");
  });
});
