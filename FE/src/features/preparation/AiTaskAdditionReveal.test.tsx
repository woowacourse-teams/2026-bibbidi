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
import { MemoryRouter } from "react-router";
import { StrictMode } from "react";

import { MyChecklistProvider } from "../checklist";
import { resetWebAuthSessionForTest } from "../../infrastructure/auth/webSessionManager";
import { preparationCatalogFixture } from "./test/fixtures/preparationCatalog.fixture";
import { RoadmapWorkspace } from "./RoadmapWorkspace";
import { AddedRoadmapTaskTitle } from "./view/AddedRoadmapTaskTitle";
import { useRoadmapTaskScroll } from "./hooks/useRoadmapTaskScroll";
import type { streamAiChat } from "../ai-chat/api/streamAiChat";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  stream: vi.fn(),
  catalog: vi.fn(),
  refreshAuth: vi.fn(),
}));
vi.mock("../auth", () => ({
  useAuth: () => ({
    authState: { status: "authenticated", user: { id: 1 } },
    refreshAuth: mocks.refreshAuth,
  }),
}));
vi.mock("../catalog", () => ({
  catalogRepository: { getCatalog: mocks.catalog },
}));
vi.mock("../ai-chat/api/streamAiChat", async (original) => ({
  ...(await original<typeof import("../ai-chat/api/streamAiChat")>()),
  streamAiChat: mocks.stream,
}));

const catalog = {
  ...preparationCatalogFixture,
  categories: preparationCatalogFixture.categories.map((category, index) => ({
    ...category,
    id: String((index + 1) * 10),
  })),
  roadmaps: preparationCatalogFixture.roadmaps.map((roadmap, index) => ({
    ...roadmap,
    categoryId: String((index + 1) * 10),
  })),
};
const item = (catalogItemId = 101) => ({
  id: catalogItemId,
  catalogItemId,
  categoryId: 10,
  title: catalogItemId === 101 ? "서버에 저장된 투어" : "서버에 저장된 예식",
  status: "prev",
  createdAt: "2026-10-15T12:00:00",
});
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
const dialogDescriptors = Object.getOwnPropertyDescriptors(
  HTMLDialogElement.prototype,
);
let mobile = false;
let reducedMotion = false;

function ScrollingTitle({
  title,
  onComplete,
  enabled = true,
}: {
  title: string;
  onComplete: () => void;
  enabled?: boolean;
}) {
  const { ref, isReady } = useRoadmapTaskScroll(
    enabled ? "added-task" : undefined,
  );
  return (
    <ul>
      <li ref={ref}>
        {enabled ? (
          <AddedRoadmapTaskTitle
            title={title}
            isReady={isReady}
            onComplete={onComplete}
          />
        ) : (
          title
        )}
      </li>
    </ul>
  );
}

function workspace() {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={["/preparation?categoryId=20"]}>
        <MyChecklistProvider sessionKey="ai-addition-reveal">
          <RoadmapWorkspace
            renderCatalogRoadmap={({ viewSwitcher }) => (
              <div>
                {viewSwitcher}
                <p>전체 단계 화면</p>
              </div>
            )}
          />
        </MyChecklistProvider>
      </MemoryRouter>
    </StrictMode>,
  );
}

async function recommend() {
  if (mobile)
    fireEvent.click(screen.getByRole("button", { name: "AI와 대화하기" }));
  fireEvent.change(await screen.findByRole("textbox"), {
    target: { value: "추천해줘" },
  });
  fireEvent.click(screen.getByRole("button", { name: "메시지 전송" }));
  return screen.findByRole("button", { name: "현재 추천: 웨딩홀 투어" });
}

beforeEach(() => {
  vi.resetAllMocks();
  mobile = false;
  reducedMotion = false;
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches:
        query === "(prefers-reduced-motion: reduce)" ? reducedMotion : mobile,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    },
  });
  mocks.catalog.mockResolvedValue(catalog);
  mocks.stream.mockImplementation(
    async (_request, receiver: Parameters<typeof streamAiChat>[1]) => {
      receiver.onDelta("추천한 일을 담아보세요.");
      receiver.onRecommendations?.(["101", "201"]);
    },
  );
  mocks.fetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/api/checklists/me") return json({ id: 1, items: [] });
    if (url === "/api/checklists/me/catalog-items") {
      return json({ items: [item(JSON.parse(init!.body as string)[0])] }, 201);
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  resetWebAuthSessionForTest();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const method of ["showModal", "close"] as const) {
    if (dialogDescriptors[method])
      Object.defineProperty(
        HTMLDialogElement.prototype,
        method,
        dialogDescriptors[method],
      );
    else
      delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>)[
        method
      ];
  }
});

describe("AI 할 일 추가 연출", () => {
  it("저장 성공을 기다린 뒤 전체 단계에서 내 로드맵과 대상 카테고리로 이동해 서버 제목을 표시한다", async () => {
    let finish!: (response: Response) => void;
    mocks.fetch.mockImplementation(async (url: string) =>
      url.endsWith("catalog-items")
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : json({ id: 1, items: [] }),
    );
    const { container } = workspace();
    await screen.findByRole("heading", { name: "스드메 로드맵" });
    fireEvent.click(screen.getByRole("button", { name: "전체 단계" }));
    fireEvent.click(await recommend());
    await waitFor(() => expect(finish).toBeTypeOf("function"));
    expect(screen.getByText("전체 단계 화면")).toBeTruthy();
    expect(
      container.querySelector(".personal-roadmap__title-typing"),
    ).toBeNull();
    await act(async () => finish(json({ items: [item()] }, 201)));
    await screen.findByRole("heading", { name: "웨딩홀 로드맵" });
    await waitFor(() =>
      expect(
        container.querySelector(".personal-roadmap__title-typing"),
      ).not.toBeNull(),
    );
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
    expect(screen.getByLabelText("AI 채팅")).toBeTruthy();
    await waitFor(
      () =>
        expect(
          container.querySelector(".personal-roadmap__title-typing"),
        ).toBeNull(),
      { timeout: 3000 },
    );
    expect(
      within(
        screen.getByRole("list", { name: "내 할 일이 있는 단계" }),
      ).getByText("서버에 저장된 투어"),
    ).toBeTruthy();
    expect(mocks.stream).toHaveBeenCalledOnce();
  });

  it("모바일은 연출 후 채팅으로 복귀하고 대화·입력·스크롤·다음 추천을 유지한다", async () => {
    mobile = true;
    const { container } = workspace();
    const card = await recommend();
    const log = screen.getByRole("log");
    log.scrollTop = 123;
    fireEvent.scroll(log);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "다음에 물어볼 내용" },
    });
    fireEvent.click(card);
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "AI 채팅" })).toBeNull(),
    );
    await waitFor(() =>
      expect(
        container.querySelector(".personal-roadmap__title-typing"),
      ).not.toBeNull(),
    );
    await screen.findByRole("dialog", { name: "AI 채팅" }, { timeout: 3000 });
    expect(screen.getByRole("log").scrollTop).toBe(123);
    expect(screen.getByText("추천한 일을 담아보세요.")).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "다음에 물어볼 내용",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "현재 추천: 예식 형태 결정" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "AI 채팅" })).toBeNull(),
    );
    await screen.findByRole("dialog", { name: "AI 채팅" }, { timeout: 3000 });
    expect(
      screen.getByText("추천을 모두 확인했어요. 더 궁금한 준비가 있나요?"),
    ).toBeTruthy();
    expect(mocks.stream).toHaveBeenCalledOnce();
  });

  it("PC에서 연속으로 추가하면 첫 연출을 마친 뒤 다음 할 일을 연출한다", async () => {
    const { container } = workspace();
    fireEvent.click(await recommend());
    await waitFor(() =>
      expect(
        container.querySelector(".personal-roadmap__title-reserve")
          ?.textContent,
      ).toBe("서버에 저장된 투어"),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "현재 추천: 예식 형태 결정" }),
    );
    await screen.findByText("추천을 모두 확인했어요. 더 궁금한 준비가 있나요?");
    expect(
      container.querySelectorAll(".personal-roadmap__title-typing"),
    ).toHaveLength(1);
    expect(screen.getByRole("log")).toBeTruthy();
    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(
      container.querySelector(".personal-roadmap__title-reserve")?.textContent,
    ).toBe("서버에 저장된 투어");
    await waitFor(
      () =>
        expect(
          container.querySelector(".personal-roadmap__title-reserve")
            ?.textContent,
        ).toBe("서버에 저장된 예식"),
      { timeout: 3000 },
    );
    await waitFor(
      () =>
        expect(
          container.querySelector(".personal-roadmap__title-typing"),
        ).toBeNull(),
      { timeout: 3000 },
    );
  });

  it("모바일 저장 실패는 채팅에 남고 재시도 성공 후에만 연출한다", async () => {
    mobile = true;
    mocks.fetch.mockImplementation(async (url: string) =>
      url.endsWith("catalog-items")
        ? json({}, 500)
        : json({ id: 1, items: [] }),
    );
    const { container } = workspace();
    fireEvent.click(await recommend());
    const retry = await screen.findByRole("button", { name: "저장 다시 시도" });
    expect(screen.getByRole("dialog", { name: "AI 채팅" })).toBeTruthy();
    expect(
      container.querySelector(".personal-roadmap__title-typing"),
    ).toBeNull();
    mocks.fetch.mockResolvedValue(json({ items: [item()] }, 201));
    fireEvent.click(retry);
    await waitFor(() =>
      expect(
        container.querySelector(".personal-roadmap__title-typing"),
      ).not.toBeNull(),
    );
    await screen.findByRole("dialog", { name: "AI 채팅" }, { timeout: 3000 });
  });

  it("사용자가 카테고리를 바꾸면 진행 중·대기 중인 연출을 취소하고 돌아와도 재생하지 않는다", async () => {
    const { container } = workspace();
    fireEvent.click(await recommend());
    await waitFor(() =>
      expect(
        container.querySelector(".personal-roadmap__title-reserve")
          ?.textContent,
      ).toBe("서버에 저장된 투어"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "현재 추천: 예식 형태 결정" }),
    );
    await screen.findByText("추천을 모두 확인했어요. 더 궁금한 준비가 있나요?");
    await waitFor(() =>
      expect(
        container.querySelector(".personal-roadmap__title-typing"),
      ).not.toBeNull(),
    );
    fireEvent.click(screen.getByRole("button", { name: /^스드메$/ }));
    expect(screen.getByRole("heading", { name: "스드메 로드맵" })).toBeTruthy();
    expect(
      container.querySelector(".personal-roadmap__title-typing"),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^웨딩홀$/ }));
    expect(
      container.querySelector(".personal-roadmap__title-typing"),
    ).toBeNull();
    expect(screen.getByText("서버에 저장된 투어")).toBeTruthy();
    expect(screen.getByText("서버에 저장된 예식")).toBeTruthy();
  });

  it("연속 저장 후 목록 갱신이 늦어져도 대기 항목을 버리지 않고 모두 연출한다", async () => {
    const { container } = workspace();
    fireEvent.click(await recommend());
    await waitFor(() =>
      expect(
        container.querySelector(".personal-roadmap__title-reserve")
          ?.textContent,
      ).toBe("서버에 저장된 투어"),
    );
    let release!: () => void;
    mocks.catalog.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(catalog);
        }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "현재 추천: 예식 형태 결정" }),
    );
    await waitFor(() => expect(release).toBeTypeOf("function"));
    await screen.findByText("추천을 모두 확인했어요. 더 궁금한 준비가 있나요?");
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
    });
    await act(async () => release());
    await waitFor(() =>
      expect(
        container.querySelector(".personal-roadmap__title-reserve")
          ?.textContent,
      ).toBe("서버에 저장된 투어"),
    );
    await waitFor(
      () =>
        expect(
          container.querySelector(".personal-roadmap__title-reserve")
            ?.textContent,
        ).toBe("서버에 저장된 예식"),
      { timeout: 3000 },
    );
    await waitFor(
      () =>
        expect(
          container.querySelector(".personal-roadmap__title-typing"),
        ).toBeNull(),
      { timeout: 3000 },
    );
  });

  it("모바일 모션 줄이기는 저장된 제목을 바로 표시하고 다음 추천으로 복귀한다", async () => {
    mobile = true;
    reducedMotion = true;
    const { container } = workspace();
    fireEvent.click(await recommend());
    await screen.findByRole("button", { name: "현재 추천: 예식 형태 결정" });
    expect(screen.getByRole("dialog", { name: "AI 채팅" })).toBeTruthy();
    expect(
      container.querySelector(".personal-roadmap__title-typing"),
    ).toBeNull();
    expect(
      container.querySelector(".personal-roadmap__task-title")?.textContent,
    ).toBe("서버에 저장된 투어");
  });

  it("저장은 성공했지만 대상 로드맵을 표시하지 못해도 채팅으로 복귀한다", async () => {
    mobile = true;
    const { container } = workspace();
    const card = await recommend();
    mocks.catalog.mockRejectedValueOnce(new Error("catalog unavailable"));
    fireEvent.click(card);
    await screen.findByText("로드맵을 불러오지 못했어요.");
    await screen.findByRole("dialog", { name: "AI 채팅" });
    expect(
      screen.getByRole("button", { name: "현재 추천: 예식 형태 결정" }),
    ).toBeTruthy();
    expect(
      container.querySelector(".personal-roadmap__title-typing"),
    ).toBeNull();
  });

  it.each([false, true])(
    "기존 항목 또는 서버 중복 응답에는 새 추가 연출을 하지 않는다: %s",
    async (serverDuplicate) => {
      mocks.fetch.mockImplementation(async (url: string) =>
        url.endsWith("catalog-items")
          ? json({ errorCode: 403, message: "이미 추가된 항목입니다." }, 409)
          : json({
              id: 1,
              items: serverDuplicate ? [] : [{ ...item(), appointments: [] }],
            }),
      );
      const { container } = workspace();
      fireEvent.click(await recommend());
      await screen.findByRole("button", { name: "현재 추천: 예식 형태 결정" });
      expect(
        container.querySelector(".personal-roadmap__title-typing"),
      ).toBeNull();
      expect(
        screen.getByRole("heading", { name: "스드메 로드맵" }),
      ).toBeTruthy();
    },
  );

  it("한글과 이모지를 글자 단위로 표시하고 화면 이탈 시 예약된 연출을 취소한다", async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const { container, unmount } = render(
      <AddedRoadmapTaskTitle title="가👩‍❤️‍👩나" isReady onComplete={onComplete} />,
    );
    const typing = container.querySelector(".personal-roadmap__title-typing")!;
    expect(typing.textContent).toBe("");
    await act(async () => vi.advanceTimersByTime(0));
    expect(typing.textContent).toBe("가");
    await act(async () => vi.advanceTimersByTime(45));
    expect(typing.textContent).toBe("가👩‍❤️‍👩");
    unmount();
    await act(async () => vi.advanceTimersByTime(2000));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("모션 줄이기에서는 전체 제목을 즉시 표시하고 부드러운 이동과 타이핑을 생략한다", () => {
    reducedMotion = true;
    const onComplete = vi.fn();
    const { container } = render(
      <ul>
        <li>
          <AddedRoadmapTaskTitle
            title="새 할 일"
            isReady
            onComplete={onComplete}
          />
        </li>
      </ul>,
    );
    expect(
      container.querySelector(".personal-roadmap__title-typing")?.textContent,
    ).toBe("새 할 일");
    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("350ms가 지나도 대상이 이동 중이면 타이핑하지 않고 이동이 멈춘 뒤 시작한다", async () => {
    vi.useFakeTimers();
    let moving = true;
    let top = 100;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () => {
        if (moving) top -= 1;
        return new DOMRect(0, top, 100, 40);
      },
    );
    const { container } = render(
      <ScrollingTitle title="가나다" onComplete={vi.fn()} />,
    );
    const typing = container.querySelector(".personal-roadmap__title-typing")!;
    await act(async () => vi.advanceTimersByTime(400));
    expect(typing.textContent).toBe("");
    moving = false;
    await act(async () => vi.advanceTimersByTime(64));
    await act(async () => vi.advanceTimersByTime(0));
    expect(typing.textContent).toBe("가");
  });

  it("화면을 떠나면 이동 확인도 중단하고 남은 타이핑을 실행하지 않는다", async () => {
    vi.useFakeTimers();
    const position = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
    const onComplete = vi.fn();
    const { unmount } = render(
      <ScrollingTitle title="새 할 일" onComplete={onComplete} />,
    );
    unmount();
    const calls = position.mock.calls.length;
    await act(async () => vi.advanceTimersByTime(2000));
    expect(position).toHaveBeenCalledTimes(calls);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("같은 항목의 연출이 다시 시작돼도 이전 이동 완료 상태를 재사용하지 않는다", async () => {
    vi.useFakeTimers();
    let moving = false;
    let top = 100;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () => {
        if (moving) top -= 1;
        return new DOMRect(0, top, 100, 40);
      },
    );
    const onComplete = vi.fn();
    const { container, rerender } = render(
      <ScrollingTitle title="가나다" onComplete={onComplete} />,
    );
    await act(async () => vi.advanceTimersByTime(64));
    await act(async () => vi.advanceTimersByTime(0));
    expect(
      container.querySelector(".personal-roadmap__title-typing")?.textContent,
    ).toBe("가");
    rerender(
      <ScrollingTitle title="가나다" enabled={false} onComplete={onComplete} />,
    );
    moving = true;
    rerender(<ScrollingTitle title="가나다" onComplete={onComplete} />);
    await act(async () => vi.advanceTimersByTime(400));
    expect(
      container.querySelector(".personal-roadmap__title-typing")?.textContent,
    ).toBe("");
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("모션 줄이기는 카드의 즉시 이동 후 연출을 완료한다", async () => {
    vi.useFakeTimers();
    reducedMotion = true;
    const onComplete = vi.fn();
    render(<ScrollingTitle title="새 할 일" onComplete={onComplete} />);
    await act(async () => vi.advanceTimersByTime(16));
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: "instant",
      block: "nearest",
      inline: "center",
    });
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
