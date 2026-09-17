import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFeedback } from "./api/createFeedback";
import { FeedbackFeature } from "./FeedbackFeature";

vi.mock("./api/createFeedback", () => ({
  createFeedback: vi.fn(),
}));

const createFeedbackMock = vi.mocked(createFeedback);

beforeEach(() => {
  createFeedbackMock.mockReset();
  createFeedbackMock.mockResolvedValue();
  setMobileViewport(false);
});

function setMobileViewport(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      addEventListener: () => undefined,
      matches: query === "(max-width: 760px)" ? matches : false,
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
  it("만족도를 선택하기 전에는 제출할 수 없다", () => {
    render(<FeedbackFeature />);
    openFeedback();

    expect(getSubmitButton().disabled).toBe(true);
  });

  it("의견 입력을 200자로 제한한다", () => {
    render(<FeedbackFeature />);
    openFeedback();

    expect(
      screen.getByLabelText("의견을 들려주세요").getAttribute("maxlength"),
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
    fireEvent.change(screen.getByLabelText("의견을 들려주세요"), {
      target: { value: "조금 아쉬웠어요" },
    });
    fireEvent.click(getSubmitButton());

    expect(createFeedbackMock).toHaveBeenCalledWith({
      content: "조금 아쉬웠어요",
      sentiment: "bad",
    });
    expect(
      await screen.findByText("소중한 의견을 보내주셔서 감사해요."),
    ).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("내용이 공백이면 null로 전송한다", async () => {
    render(<FeedbackFeature />);
    openFeedback();

    fireEvent.click(screen.getByRole("button", { name: "좋았어요" }));
    fireEvent.change(screen.getByLabelText("의견을 들려주세요"), {
      target: { value: "   " },
    });
    fireEvent.click(getSubmitButton());

    await waitFor(() =>
      expect(createFeedbackMock).toHaveBeenCalledWith({
        content: null,
        sentiment: "good",
      }),
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
        name: "보내는 중...",
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
      (screen.getByLabelText("의견을 들려주세요") as HTMLTextAreaElement)
        .disabled,
    ).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(submitButton);
    expect(createFeedbackMock).toHaveBeenCalledOnce();

    resolveRequest?.();
    await screen.findByText("소중한 의견을 보내주셔서 감사해요.");
  });

  it("전송에 실패하면 입력값을 유지하고 재시도 오류를 표시한다", async () => {
    createFeedbackMock.mockRejectedValueOnce(new Error("request failed"));
    render(<FeedbackFeature />);
    openFeedback();

    fireEvent.click(screen.getByRole("button", { name: "좋았어요" }));
    fireEvent.change(screen.getByLabelText("의견을 들려주세요"), {
      target: { value: "좋았어요" },
    });
    fireEvent.click(getSubmitButton());

    expect((await screen.findByRole("alert")).textContent).toBe(
      "의견을 보내지 못했어요. 다시 시도해 주세요.",
    );
    expect(
      (screen.getByLabelText("의견을 들려주세요") as HTMLTextAreaElement).value,
    ).toBe("좋았어요");
    expect(getSubmitButton().disabled).toBe(false);
  });

  it("Escape 키로 닫고 플로팅 버튼에 포커스를 돌려준다", () => {
    render(<FeedbackFeature />);
    openFeedback();

    fireEvent.keyDown(document, { key: "Escape" });

    const trigger = screen.getByRole("button", { name: "의견 보내기" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("모바일에서는 Bottom Sheet를 열고 닫기 애니메이션 뒤 포커스를 돌려준다", () => {
    setMobileViewport(true);
    render(<FeedbackFeature />);
    openFeedback();

    const dialog = screen.getByRole("dialog");
    const dragHandle = within(dialog).getByRole("button", {
      name: "아래로 밀어 피드백 창 닫기",
    });

    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(dragHandle);
    expect(
      within(dialog).queryByRole("button", { name: "피드백 창 닫기" }),
    ).toBeNull();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(
      screen.getAllByRole("button", { name: "피드백 창 닫기" })[0],
    );

    expect(dialog.parentElement?.className).toContain(
      "bottom-sheet-dismiss--closing",
    );
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.transitionEnd(dialog, { propertyName: "transform" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "의견 보내기" }),
    );
  });

  it("모바일 Bottom Sheet의 핸들을 충분히 아래로 드래그하면 닫는다", () => {
    setMobileViewport(true);
    render(<FeedbackFeature />);
    openFeedback();

    const dialog = screen.getByRole("dialog");
    const dragHandle = within(dialog).getByRole("button", {
      name: "아래로 밀어 피드백 창 닫기",
    });

    fireEvent.pointerDown(dragHandle, {
      button: 0,
      clientY: 20,
      pointerId: 1,
      pointerType: "touch",
    });
    fireEvent.pointerMove(dragHandle, {
      clientY: 140,
      pointerId: 1,
      pointerType: "touch",
    });
    fireEvent.pointerUp(dragHandle, {
      clientY: 140,
      pointerId: 1,
      pointerType: "touch",
    });

    expect(dialog.parentElement?.className).toContain(
      "bottom-sheet-dismiss--closing",
    );
    fireEvent.transitionEnd(dialog, { propertyName: "transform" });
    expect(screen.queryByRole("dialog")).toBeNull();
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
    const dragHandle = await within(dialog).findByRole("button", {
      name: "아래로 밀어 피드백 창 닫기",
    });
    expect((dragHandle as HTMLButtonElement).disabled).toBe(true);

    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.click(
      screen.getAllByRole("button", { name: "피드백 창 닫기" })[0],
    );

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(dialog.parentElement?.className).not.toContain(
      "bottom-sheet-dismiss--closing",
    );

    resolveRequest?.();
    await screen.findByText("소중한 의견을 보내주셔서 감사해요.");
  });
});
