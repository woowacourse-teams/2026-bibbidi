import { MOBILE_LAYOUT_MEDIA_QUERY } from "../../shared/responsive";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installMatchMedia } from "../../test/matchMedia";
import { createFeedback } from "./api/createFeedback";
import { FeedbackFeature as Feature } from "./FeedbackFeature";

function FeedbackFeature() {
  return (
    <Feature
      renderTrigger={(open, ref) => (
        <button ref={ref} onClick={open}>
          의견 보내기
        </button>
      )}
    />
  );
}

const analyticsMocks = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock("../../infrastructure/analytics", () => ({
  analytics: { initialize: vi.fn(), track: analyticsMocks.track },
}));
vi.mock("./api/createFeedback", () => ({
  createFeedback: vi.fn(),
}));

const createFeedbackMock = vi.mocked(createFeedback);

beforeEach(() => {
  analyticsMocks.track.mockReset();
  createFeedbackMock.mockReset();
  createFeedbackMock.mockResolvedValue();
  setMobileViewport(false);
});

afterEach(() => vi.unstubAllGlobals());

function setMobileViewport(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      addEventListener: () => undefined,
      matches: query === MOBILE_LAYOUT_MEDIA_QUERY ? matches : false,
      removeEventListener: () => undefined,
    }),
  });
}

function openFeedback() {
  fireEvent.click(screen.getByRole("button", { name: "의견 보내기" }));
}

function getSubmitButton() {
  return within(screen.getByRole("dialog")).getByRole("button", {
    name: "의견 보내기",
  }) as HTMLButtonElement;
}

describe("FeedbackFeature", () => {
  it.each([false, true])(
    "모바일 여부 %s에서 전송 중 버튼 초점을 유지하고 실패 후 재시도할 수 있다",
    async (isMobile) => {
      setMobileViewport(isMobile);
      let fail!: (error: Error) => void;
      createFeedbackMock.mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            fail = reject;
          }),
      );
      render(<FeedbackFeature />);
      openFeedback();
      fireEvent.click(screen.getByRole("button", { name: "좋았어요" }));
      const submit = getSubmitButton();
      submit.focus();
      fireEvent.click(submit);
      expect(submit.disabled).toBe(false);
      expect(submit.getAttribute("aria-busy")).toBe("true");
      expect(document.activeElement).toBe(submit);
      fireEvent.click(submit);
      expect(createFeedbackMock).toHaveBeenCalledOnce();
      await act(async () => fail(new Error("network")));
      await screen.findByRole("alert");
      expect(document.activeElement).toBe(submit);
      expect(submit.disabled).toBe(false);
      expect(submit.getAttribute("aria-busy")).not.toBe("true");
    },
  );

  it.each([false, true])(
    "모바일 여부 %s에서 닫는 도중 너비가 바뀌어도 퇴장 레이어와 스크롤 잠금을 유지한다",
    async (isMobile) => {
      const media = installMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY, isMobile);
      render(<FeedbackFeature />);
      openFeedback();
      const layer = screen.getByRole("dialog");
      let finish!: () => void;
      const finished = new Promise<void>((resolve) => {
        finish = resolve;
      });
      Object.defineProperty(layer.firstElementChild, "getAnimations", {
        value: () => [{ finished }],
      });
      fireEvent.keyDown(layer, { key: "Escape" });
      expect(layer.dataset.state).toBe("closing");
      act(() => media.setMatches(!isMobile));
      expect(layer.isConnected).toBe(true);
      expect(screen.getByRole("dialog")).toBe(layer);
      expect(document.body.style.overflow).toBe("hidden");
      await act(async () => finish());
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(document.body.style.overflow).toBe("");
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "의견 보내기" }),
      );
    },
  );

  it("만족도를 선택하기 전에는 제출할 수 없다", () => {
    render(<FeedbackFeature />);
    openFeedback();

    expect(getSubmitButton().disabled).toBe(true);
  });

  it("의견 입력을 200자로 제한한다", () => {
    render(<FeedbackFeature />);
    openFeedback();

    expect(
      screen
        .getByLabelText("의견을 들려주세요 (선택)")
        .getAttribute("maxlength"),
    ).toBe("200");
  });

  it("만족도를 선택하면 제출할 수 있다", () => {
    render(<FeedbackFeature />);
    openFeedback();

    fireEvent.click(screen.getByRole("button", { name: "좋았어요" }));

    expect(getSubmitButton().disabled).toBe(false);
  });

  it("제출에 성공하면 API에 입력값을 보내고 성공 Snackbar를 표시한다", async () => {
    render(<FeedbackFeature />);
    openFeedback();

    fireEvent.click(screen.getByRole("button", { name: "아쉬워요" }));
    fireEvent.change(screen.getByLabelText("의견을 들려주세요 (선택)"), {
      target: { value: "조금 아쉬웠어요" },
    });
    fireEvent.click(getSubmitButton());

    expect(createFeedbackMock).toHaveBeenCalledWith(
      {
        content: "조금 아쉬웠어요",
        sentiment: "bad",
      },
      expect.any(AbortSignal),
    );
    expect(analyticsMocks.track).not.toHaveBeenCalled();
    expect(
      await screen.findByText("소중한 의견을 보내주셔서 감사해요."),
    ).toBeTruthy();
    expect(analyticsMocks.track).toHaveBeenCalledOnce();
    expect(analyticsMocks.track).toHaveBeenCalledWith({
      name: "feedback_submit",
      parameters: { source: "service_layout" },
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("내용이 공백이면 null로 전송한다", async () => {
    render(<FeedbackFeature />);
    openFeedback();

    fireEvent.click(screen.getByRole("button", { name: "좋았어요" }));
    fireEvent.change(screen.getByLabelText("의견을 들려주세요 (선택)"), {
      target: { value: "   " },
    });
    fireEvent.click(getSubmitButton());

    await waitFor(() =>
      expect(createFeedbackMock).toHaveBeenCalledWith(
        {
          content: null,
          sentiment: "good",
        },
        expect.any(AbortSignal),
      ),
    );
  });

  it("전송 중에는 중복 제출할 수 없다", async () => {
    let resolveRequest: (() => void) | undefined;
    createFeedbackMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    render(<FeedbackFeature />);
    openFeedback();

    fireEvent.click(screen.getByRole("button", { name: "좋았어요" }));
    const submitButton = getSubmitButton();
    fireEvent.click(submitButton);

    expect(
      await within(screen.getByRole("dialog")).findByRole("button", {
        name: "의견 보내기",
      }),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "좋았어요" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "아쉬워요" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText("의견을 들려주세요 (선택)") as HTMLTextAreaElement)
        .disabled,
    ).toBe(true);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(submitButton);
    expect(createFeedbackMock).toHaveBeenCalledOnce();
    expect(analyticsMocks.track).not.toHaveBeenCalled();

    resolveRequest?.();
    await screen.findByText("소중한 의견을 보내주셔서 감사해요.");
    expect(analyticsMocks.track).toHaveBeenCalledOnce();
  });

  it("unmount 시 전송을 중단하고 늦은 성공 이벤트를 보내지 않는다", async () => {
    let resolveRequest: (() => void) | undefined;
    let requestSignal: AbortSignal | undefined;
    createFeedbackMock.mockImplementation((_values, signal) => {
      requestSignal = signal;
      return new Promise<void>((resolve) => {
        resolveRequest = resolve;
      });
    });
    const view = render(<FeedbackFeature />);
    openFeedback();
    fireEvent.click(screen.getByRole("button", { name: "좋았어요" }));
    fireEvent.click(getSubmitButton());

    view.unmount();

    expect(requestSignal?.aborted).toBe(true);
    await act(async () => resolveRequest?.());
    expect(analyticsMocks.track).not.toHaveBeenCalled();
  });

  it("전송에 실패하면 입력값을 유지하고 재시도 오류를 표시한다", async () => {
    createFeedbackMock.mockRejectedValueOnce(new Error("request failed"));
    render(<FeedbackFeature />);
    openFeedback();

    fireEvent.click(screen.getByRole("button", { name: "좋았어요" }));
    fireEvent.change(screen.getByLabelText("의견을 들려주세요 (선택)"), {
      target: { value: "좋았어요" },
    });
    fireEvent.click(getSubmitButton());

    expect((await screen.findByRole("alert")).textContent).toBe(
      "의견을 보내지 못했어요. 다시 시도해 주세요.",
    );
    expect(
      (screen.getByLabelText("의견을 들려주세요 (선택)") as HTMLTextAreaElement)
        .value,
    ).toBe("좋았어요");
    expect(getSubmitButton().disabled).toBe(false);
    expect(analyticsMocks.track).not.toHaveBeenCalled();
  });

  it("Escape 키로 닫고 메뉴 버튼에 포커스를 돌려준다", async () => {
    render(<FeedbackFeature />);
    openFeedback();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const trigger = screen.getByRole("button", { name: "의견 보내기" });
    expect(document.activeElement).toBe(trigger);
  });

  it("모바일에서는 Bottom Sheet를 열고 닫기 애니메이션 뒤 포커스를 돌려준다", async () => {
    setMobileViewport(true);
    render(<FeedbackFeature />);
    openFeedback();

    const dialog = screen.getByRole("dialog");
    const dragHandle = within(dialog).getByRole("button", {
      name: "아래로 밀어 닫기",
    });

    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(dragHandle);
    expect(
      within(dialog).queryByRole("button", { name: "피드백 창 닫기" }),
    ).toBeNull();
    expect(document.body.style.overflow).toBe("hidden");

    let finish!: () => void;
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    Object.defineProperty(dialog.firstElementChild, "getAnimations", {
      value: () => [{ finished }],
    });
    fireEvent.pointerDown(dialog, { isPrimary: true });
    fireEvent.pointerUp(dialog);
    fireEvent.click(dialog);
    expect(dialog.dataset.state).toBe("closing");
    expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => finish());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "의견 보내기" }),
    );
  });

  it("모바일 Bottom Sheet의 핸들을 충분히 아래로 드래그하면 닫는다", async () => {
    setMobileViewport(true);
    render(<FeedbackFeature />);
    openFeedback();

    const dialog = screen.getByRole("dialog");
    const dragHandle = within(dialog).getByRole("button", {
      name: "아래로 밀어 닫기",
    });

    const touch = (clientY: number) => ({
      identifier: 1,
      clientX: 100,
      clientY,
    });
    fireEvent.touchStart(dragHandle, { touches: [touch(20)] });
    fireEvent.touchMove(dragHandle, { touches: [touch(140)] });
    fireEvent.touchEnd(dragHandle, {
      touches: [],
      changedTouches: [touch(140)],
    });
    expect(dialog.dataset.state).toBe("closing");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("모바일에서 전송 중에는 바텀시트를 닫거나 드래그할 수 없다", async () => {
    let resolveRequest: (() => void) | undefined;
    createFeedbackMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    setMobileViewport(true);
    render(<FeedbackFeature />);
    openFeedback();

    fireEvent.click(screen.getByRole("button", { name: "좋았어요" }));
    fireEvent.click(getSubmitButton());

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).queryByRole("button", { name: "아래로 밀어 닫기" }),
    ).toBeNull();
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.pointerDown(dialog, { isPrimary: true });
    fireEvent.pointerUp(dialog);
    fireEvent.click(dialog);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(dialog.dataset.state).toBe("open");

    resolveRequest?.();
    await screen.findByText("소중한 의견을 보내주셔서 감사해요.");
  });
});
