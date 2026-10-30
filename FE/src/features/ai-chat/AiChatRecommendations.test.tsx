import { MOBILE_LAYOUT_MEDIA_QUERY } from "../../shared/responsive";
import { MemoryRouter } from "react-router";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
    <MemoryRouter>
      <MyChecklistProvider sessionKey="recommendation-test">
        <AiChatFeature
          isAuthenticated
          onAuthenticationRequired={authRequired}
        />
        {observe ? <ChecklistObserver /> : null}
      </MyChecklistProvider>
    </MemoryRouter>
  );
}
function renderChat(ui: Parameters<typeof render>[0]) {
  const result = render(ui);
  fireEvent.click(screen.getByRole("button", { name: "AI" }));
  return result;
}
async function send() {
  fireEvent.change(await screen.findByRole("textbox"), {
    target: { value: "추천해줘" },
  });
  fireEvent.click(screen.getByRole("button", { name: "메시지 전송" }));
}
const task = (name: string) =>
  screen.getByRole<HTMLInputElement>("checkbox", { name });
const addSelected = () =>
  fireEvent.click(screen.getByRole("button", { name: /^\d+개 추가$/ }));
async function selectFirst() {
  fireEvent.click(await screen.findByRole("checkbox", { name: "웨딩홀 투어" }));
  addSelected();
}
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
  restoreDialog = installDialogMock();
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
});

describe("AI 추천 목록 연결", () => {
  it.each([false, true])(
    "선택 유무(%s)와 관계없이 건너뛰면 저장 없이 접고 다시 볼 수 있다",
    async (selected) => {
      renderChat(chat());
      await send();
      const first = await screen.findByRole("checkbox", {
        name: "웨딩홀 투어",
      });
      if (selected) fireEvent.click(first);
      fireEvent.click(screen.getByRole("button", { name: "건너뛰기" }));
      const restore = screen.getByRole("button", { name: "추천 다시 보기" });
      expect(
        screen.queryByRole("checkbox", { name: "웨딩홀 투어" }),
      ).toBeNull();
      expect(screen.getByText("마음에 드는 일을 담아보세요.")).toBeTruthy();
      expect(screen.getByText("추천을 건너뛰었어요.")).toBeTruthy();
      expect(document.activeElement).toBe(restore);
      expect(mocks.fetch).not.toHaveBeenCalled();
      fireEvent.click(restore);
      expect(task("웨딩홀 투어").checked).toBe(false);
      expect(
        screen.getByRole<HTMLButtonElement>("button", { name: "0개 추가" })
          .disabled,
      ).toBe(true);
      expect(document.activeElement).toBe(task("웨딩홀 투어"));
      expect(mocks.catalog).toHaveBeenCalledOnce();
      expect(mocks.stream).toHaveBeenCalledOnce();
    },
  );

  it("건너뛰기는 해당 답변만 접으며 채팅을 닫았다 열어도 유지한다", async () => {
    renderChat(chat());
    await send();
    await screen.findByRole("checkbox", { name: "웨딩홀 투어" });
    fireEvent.click(screen.getByRole("button", { name: "건너뛰기" }));
    fireEvent.click(screen.getByRole("button", { name: "AI 채팅 닫기" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "AI 채팅" })).toBeNull(),
    );
    fireEvent.click(screen.getByRole("button", { name: "AI" }));
    expect(screen.getByRole("button", { name: "추천 다시 보기" })).toBeTruthy();
    await send();
    await screen.findByRole("checkbox", { name: "웨딩홀 투어" });
    expect(screen.getByRole("button", { name: "추천 다시 보기" })).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("추천 도착 후 목록까지 스크롤하고 다음 답변에서도 카탈로그를 재사용한다", async () => {
    mockChatScrollHeight();
    const finishCatalog = pendingCatalog();
    renderChat(chat());
    await send();
    await screen.findByText("추천 할 일을 불러오고 있어요.");
    const log = screen.getByRole("log");
    expect(log.scrollTop).toBe(600);
    await finishCatalog();
    expect(task("웨딩홀 투어")).toBeTruthy();
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

  it("닫힌 모바일에서 늦게 도착한 추천은 다시 열 때 보여주고 읽던 스크롤을 보존한다", async () => {
    mockMobileDialog();
    mockChatScrollHeight();
    const finishCatalog = pendingCatalog();
    renderChat(chat());
    fireEvent.click(screen.getByRole("button", { name: "AI" }));
    await send();
    await screen.findByText("추천 할 일을 불러오고 있어요.");
    const log = screen.getByRole("log");
    expect(log.scrollTop).toBe(600);
    fireEvent.click(screen.getByRole("button", { name: "AI 대화 접기" }));
    await finishCatalog();
    expect(log.scrollTop).toBe(600);
    act(() => screen.getByRole("textbox").focus());
    expect(log.scrollTop).toBe(1000);
    log.scrollTop = 250;
    fireEvent.scroll(log);
    fireEvent.click(screen.getByRole("button", { name: "AI 대화 접기" }));
    log.scrollTop = 0;
    fireEvent.scroll(log);
    act(() => screen.getByRole("textbox").focus());
    expect(log.scrollTop).toBe(250);
  });

  it("완료 후 서버 순서로 목록을 표시하고 알 수 없는 ID를 제외한다", async () => {
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
    renderChat(chat());
    await send();
    expect(screen.queryByRole("region", { name: "추천 할 일" })).toBeNull();
    expect(mocks.catalog).not.toHaveBeenCalled();
    await act(async () => finish());
    await screen.findByRole("checkbox", { name: "예식 형태 결정" });
    expect(
      screen
        .getAllByRole("checkbox")
        .map((input) => input.getAttribute("aria-label")),
    ).toEqual(["예식 형태 결정", "웨딩홀 투어"]);
    expect(screen.getByText("예식 형태·식순·입장 방식 결정")).toBeTruthy();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "0개 추가",
      }).disabled,
    ).toBe(true);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("실패한 답변의 추천을 숨기고 재시도 답변의 추천을 표시한다", async () => {
    mocks.stream.mockImplementationOnce(
      async (_request, receiver: Parameters<typeof streamAiChat>[1]) => {
        receiver.onDelta("중간 답변");
        receiver.onRecommendations?.(["201"]);
        throw new Error("failure");
      },
    );
    renderChat(chat());
    await send();
    await screen.findByText("미완료 답변");
    expect(screen.queryByRole("region", { name: "추천 할 일" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByRole("checkbox", { name: "웨딩홀 투어" });
    expect(screen.queryByText("미완료 답변")).toBeNull();
  });

  it("카탈로그만 다시 조회하며 AI 답변을 유지한다", async () => {
    mocks.catalog.mockRejectedValueOnce(new Error("network"));
    renderChat(chat());
    await send();
    fireEvent.click(
      await screen.findByRole("button", { name: "추천 다시 불러오기" }),
    );
    await screen.findByRole("checkbox", { name: "웨딩홀 투어" });
    expect(mocks.stream).toHaveBeenCalledOnce();
  });

  it("선택과 해제로 저장 없이 목록을 고른다", async () => {
    renderChat(chat());
    await send();
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "웨딩홀 투어" }),
    );
    fireEvent.click(task("예식 형태 결정"));
    expect(screen.getByText("2개 선택")).toBeTruthy();
    fireEvent.click(task("웨딩홀 투어"));
    expect(task("웨딩홀 투어").checked).toBe(false);
    expect(task("예식 형태 결정").checked).toBe(true);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("복수 선택은 한 요청으로 저장하고 저장 중 중복 실행을 막으며 공유 목록을 갱신한다", async () => {
    let finish!: (response: Response) => void;
    mocks.fetch.mockImplementation(async (url: string) =>
      url.endsWith("catalog-items")
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : json({ id: 1, items: [] }),
    );
    renderChat(chat(true));
    await send();
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "웨딩홀 투어" }),
    );
    fireEvent.click(task("예식 형태 결정"));
    addSelected();
    addSelected();
    await waitFor(() => expect(postCalls()).toHaveLength(1));
    expect(task("웨딩홀 투어").disabled).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "건너뛰기" })
        .disabled,
    ).toBe(true);
    expect(JSON.parse(postCalls()[0][1].body)).toEqual([101, 201]);
    const second = {
      ...addedItem,
      id: 2,
      catalogItemId: 201,
      categoryId: 20,
      title: "예식 형태 결정",
    };
    await act(async () => finish(json({ items: [addedItem, second] })));
    expect(screen.queryByRole("checkbox", { name: "웨딩홀 투어" })).toBeNull();
    expect(task("사회자 섭외")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByLabelText("공유 로드맵 항목").textContent).toBe(
        "웨딩홀 투어, 예식 형태 결정",
      ),
    );
    expect(
      screen.getByRole("link", { name: "추가한 일 보기" }).getAttribute("href"),
    ).toBe("/checklist");
    expect(mocks.stream).toHaveBeenCalledOnce();
  });

  it("저장 실패 후 복수 선택을 유지하고 저장만 재시도한다", async () => {
    let fail = true;
    mocks.fetch.mockImplementation(async (url: string) =>
      url.endsWith("catalog-items")
        ? fail
          ? json({}, 500)
          : json({ items: [addedItem] })
        : json({ id: 1, items: [] }),
    );
    renderChat(chat());
    await send();
    await selectFirst();
    await screen.findByRole("button", { name: "저장 다시 시도" });
    expect(task("웨딩홀 투어").checked).toBe(true);
    expect(task("웨딩홀 투어").disabled).toBe(false);
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "저장 다시 시도" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("checkbox", { name: "웨딩홀 투어" }),
      ).toBeNull(),
    );
    expect(postCalls()).toHaveLength(2);
    expect(mocks.stream).toHaveBeenCalledOnce();
  });

  it("이미 저장된 항목은 POST 없이 제외한다", async () => {
    mocks.fetch.mockResolvedValue(
      json({ id: 1, items: [{ ...addedItem, appointments: [] }] }),
    );
    renderChat(chat());
    await send();
    await selectFirst();
    await waitFor(() =>
      expect(
        screen.queryByRole("checkbox", { name: "웨딩홀 투어" }),
      ).toBeNull(),
    );
    expect(postCalls()).toHaveLength(0);
  });

  it("서버 중복 응답은 목록을 갱신해 확인하고 추천에서 제외한다", async () => {
    let reads = 0;
    mocks.fetch.mockImplementation(async (url: string) =>
      url.endsWith("catalog-items")
        ? json({ errorCode: 403, message: "duplicate" }, 409)
        : json({
            id: 1,
            items: reads++ ? [{ ...addedItem, appointments: [] }] : [],
          }),
    );
    renderChat(chat());
    await send();
    await selectFirst();
    await waitFor(() =>
      expect(
        screen.queryByRole("checkbox", { name: "웨딩홀 투어" }),
      ).toBeNull(),
    );
    expect(reads).toBe(2);
    expect(postCalls()).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "저장 다시 시도" })).toBeNull();
  });

  it("복수 선택 중 일부가 다른 곳에서 저장되면 나머지만 재요청한다", async () => {
    let reads = 0;
    let posts = 0;
    const second = {
      ...addedItem,
      id: 2,
      catalogItemId: 201,
      categoryId: 20,
      title: "예식 형태 결정",
    };
    mocks.fetch.mockImplementation(async (url: string) =>
      url.endsWith("catalog-items")
        ? posts++
          ? json({ items: [second] })
          : json({ errorCode: 403, message: "duplicate" }, 409)
        : json({
            id: 1,
            items: reads++ ? [{ ...addedItem, appointments: [] }] : [],
          }),
    );
    renderChat(chat());
    await send();
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "웨딩홀 투어" }),
    );
    fireEvent.click(task("예식 형태 결정"));
    addSelected();
    await waitFor(() =>
      expect(
        screen.queryByRole("checkbox", { name: "예식 형태 결정" }),
      ).toBeNull(),
    );
    expect(postCalls().map(([, init]) => JSON.parse(init.body))).toEqual([
      [101, 201],
      [201],
    ]);
    expect(screen.queryByRole("checkbox", { name: "웨딩홀 투어" })).toBeNull();
  });

  it("중복 응답 뒤 조회 실패 시 선택을 유지하고 조회만 재시도한다", async () => {
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
    renderChat(chat());
    await send();
    await selectFirst();
    fireEvent.click(
      await screen.findByRole("button", { name: "저장 다시 시도" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("checkbox", { name: "웨딩홀 투어" }),
      ).toBeNull(),
    );
    expect(postCalls()).toHaveLength(1);
    expect(reads).toBe(3);
  });

  it("인증 만료 시 선택을 유지하고 인증 흐름을 호출한다", async () => {
    mocks.fetch.mockResolvedValue(
      json({ errorCode: 201, message: "login" }, 401),
    );
    renderChat(chat());
    await send();
    await selectFirst();
    await screen.findByText(
      "로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요.",
    );
    expect(authRequired).toHaveBeenCalledOnce();
    expect(task("웨딩홀 투어").checked).toBe(true);
  });

  it("언마운트 시 저장을 취소한다", async () => {
    let finish!: (response: Response) => void;
    mocks.fetch.mockImplementation(async (url: string) =>
      url.endsWith("catalog-items")
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : json({ id: 1, items: [] }),
    );
    const view = renderChat(chat());
    await send();
    await selectFirst();
    await waitFor(() => expect(postCalls()).toHaveLength(1));
    const signal = postCalls()[0][1].signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => finish(json({ items: [addedItem] })));
  });

  it("모바일 접기와 PC 전환에도 복수 선택을 유지한다", async () => {
    const media = mockMobileDialog();
    renderChat(chat());
    fireEvent.click(screen.getByRole("button", { name: "AI" }));
    await send();
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "웨딩홀 투어" }),
    );
    fireEvent.click(task("예식 형태 결정"));
    fireEvent.click(screen.getByRole("button", { name: "AI 대화 접기" }));
    act(() => screen.getByRole("textbox").focus());
    expect(task("웨딩홀 투어").checked).toBe(true);
    act(() => media.setMatches(false));
    expect(task("예식 형태 결정").checked).toBe(true);
    expect(screen.getByText("2개 선택")).toBeTruthy();
  });

  it("다른 답변의 같은 추천도 저장 중에는 중복 요청하지 않는다", async () => {
    let finish!: (response: Response) => void;
    mocks.fetch.mockImplementation(async (url: string) =>
      url.endsWith("catalog-items")
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : json({ id: 1, items: [] }),
    );
    renderChat(chat());
    await send();
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "웨딩홀 투어" }),
    );
    await send();
    await waitFor(() =>
      expect(
        screen.getAllByRole("checkbox", { name: "웨딩홀 투어" }),
      ).toHaveLength(2),
    );
    fireEvent.click(
      screen.getAllByRole("checkbox", { name: "웨딩홀 투어" })[1],
    );
    const buttons = screen.getAllByRole("button", {
      name: "1개 추가",
    });
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    await waitFor(() => expect(postCalls()).toHaveLength(1));
    await act(async () => finish(json({ items: [addedItem] })));
    expect(screen.queryByRole("checkbox", { name: "웨딩홀 투어" })).toBeNull();
  });

  it("모든 항목을 저장하면 완료 상태로 초점을 옮긴다", async () => {
    mocks.stream.mockImplementationOnce(
      async (_request, receiver: Parameters<typeof streamAiChat>[1]) => {
        receiver.onDelta("추천");
        receiver.onRecommendations?.(["101"]);
      },
    );
    renderChat(chat());
    await send();
    await selectFirst();
    const complete = await screen.findByText(
      "추천을 모두 확인했어요. 더 궁금한 준비가 있나요?",
    );
    expect(screen.getAllByText("Bibbidi")).toHaveLength(1);
    await waitFor(() =>
      expect(document.activeElement).toBe(complete.closest('[role="status"]')),
    );
  });
});

describe("AI 쓰기 후 공유 체크리스트 갱신", () => {
  it.each([false, true])(
    "답변 실패 여부(%s)와 관계없이 refresh에서 목록을 다시 요청한다",
    async (failed) => {
      let reads = 0;
      mocks.fetch.mockImplementation(async () =>
        json({
          id: 1,
          items:
            ++reads > 1
              ? [{ ...addedItem, title: "AI가 수정한 할 일", appointments: [] }]
              : [],
        }),
      );
      mocks.stream.mockImplementationOnce(
        async (_request, receiver: Parameters<typeof streamAiChat>[1]) => {
          receiver.onDelta("변경했어요");
          receiver.onRefresh?.();
          if (failed) throw new Error("model failure");
        },
      );
      renderChat(chat(true));
      // Populate the shared cache, then verify that another refresh bypasses it.
      mocks.stream.mockImplementationOnce(
        async (_request, receiver: Parameters<typeof streamAiChat>[1]) => {
          receiver.onDelta("조회 답변");
          receiver.onRefresh?.();
        },
      );
      await send();
      await waitFor(() => expect(reads).toBe(1));
      await send();
      await waitFor(() =>
        expect(screen.getByLabelText("공유 로드맵 항목").textContent).toBe(
          "AI가 수정한 할 일",
        ),
      );
      expect(reads).toBe(2);
      if (failed) await screen.findByText("미완료 답변");
    },
  );

  it("갱신 조회의 인증 만료를 인증 흐름으로 전달한다", async () => {
    mocks.fetch.mockResolvedValue(
      json({ errorCode: 201, message: "login" }, 401),
    );
    mocks.stream.mockImplementationOnce(
      async (_request, receiver: Parameters<typeof streamAiChat>[1]) => {
        receiver.onDelta("변경 완료");
        receiver.onRefresh?.();
      },
    );
    renderChat(chat());
    await send();
    await screen.findByText(
      "로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요.",
    );
    expect(authRequired).toHaveBeenCalledOnce();
    expect(screen.getByText("변경 완료")).toBeTruthy();
    expect(screen.queryByText("미완료 답변")).toBeNull();
  });

  it("계정 세션이 끝나면 진행 중인 갱신 조회를 취소한다", async () => {
    let finish!: (response: Response) => void;
    mocks.fetch.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    mocks.stream.mockImplementationOnce(
      async (_request, receiver: Parameters<typeof streamAiChat>[1]) => {
        receiver.onDelta("변경 완료");
        receiver.onRefresh?.();
      },
    );
    const view = renderChat(chat());
    await send();
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
    const signal = mocks.fetch.mock.calls[0][1].signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => finish(json({ id: 1, items: [] })));
    expect(authRequired).not.toHaveBeenCalled();
  });

  it("refresh 조회 실패는 AI를 재호출하지 않고 조회만 재시도한다", async () => {
    let fail = true;
    let finish!: (response: Response) => void;
    mocks.fetch.mockImplementation(async () =>
      fail
        ? json({}, 500)
        : new Promise<Response>((resolve) => {
            finish = resolve;
          }),
    );
    mocks.stream.mockImplementationOnce(
      async (_request, receiver: Parameters<typeof streamAiChat>[1]) => {
        receiver.onDelta("변경 완료");
        receiver.onRefresh?.();
      },
    );
    renderChat(chat());
    await send();
    const retry = await screen.findByRole("button", {
      name: "체크리스트 다시 불러오기",
    });
    fail = false;
    fireEvent.click(retry);
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
    expect(
      screen.getByRole("button", { name: "체크리스트 다시 불러오기" }),
    ).toBe(retry);
    expect(retry.getAttribute("aria-busy")).toBe("true");
    await act(async () => finish(json({ id: 1, items: [] })));
    await waitFor(() =>
      expect(
        screen.queryByText("변경된 체크리스트를 불러오지 못했어요."),
      ).toBeNull(),
    );
    expect(mocks.stream).toHaveBeenCalledOnce();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
});
