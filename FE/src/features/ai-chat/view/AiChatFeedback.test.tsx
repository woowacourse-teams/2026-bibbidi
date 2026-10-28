import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiChatFeedback } from "./AiChatFeedback";
import { createFeedback } from "../../feedback/api/createFeedback";

const analyticsMocks = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("../../../infrastructure/analytics", () => ({
  analytics: { track: analyticsMocks.track },
}));
vi.mock("../../feedback/api/createFeedback", () => ({
  createFeedback: vi.fn(),
}));
const request = vi.mocked(createFeedback);
const key = "bibbidi:ai-chat-feedback:authenticated:1";
const cooldown = 7 * 24 * 60 * 60 * 1000;
function card(audienceKey = "authenticated:1", onDismiss = vi.fn()) {
  return <AiChatFeedback audienceKey={audienceKey} onDismiss={onDismiss} />;
}
beforeEach(() => {
  localStorage.clear();
  request.mockReset();
  request.mockResolvedValue();
  analyticsMocks.track.mockReset();
});

describe("AI 대화 피드백", () => {
  it("평가 뒤 선택 입력을 보여주고 대화 원문 없이 피드백을 전송한다", async () => {
    const view = render(card());
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "도움됐어요" }));
    const content = screen.getByRole("textbox", {
      name: "어떤 점이 그랬나요? (선택)",
    });
    expect(content.getAttribute("maxlength")).toBe("200");
    fireEvent.change(content, { target: { value: "준비 순서를 알게 됐어요" } });
    const now = Date.now();
    fireEvent.click(screen.getByRole("button", { name: "피드백 보내기" }));
    await screen.findByRole("status");
    expect(request).toHaveBeenCalledWith(
      {
        sentiment: "good",
        content: "[AI 대화 피드백]\n준비 순서를 알게 됐어요",
      },
      expect.any(AbortSignal),
    );
    expect(analyticsMocks.track).toHaveBeenCalledWith({
      name: "feedback_submit",
      parameters: { source: "ai_chat" },
    });
    expect(Number(localStorage.getItem(key))).toBeGreaterThanOrEqual(
      now + cooldown,
    );
    view.unmount();
    render(card());
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("자유 의견 없이도 평가만 전송할 수 있다", async () => {
    render(card());
    fireEvent.click(screen.getByRole("button", { name: "아쉬웠어요" }));
    fireEvent.click(screen.getByRole("button", { name: "피드백 보내기" }));
    await screen.findByRole("status");
    expect(request).toHaveBeenCalledWith(
      { sentiment: "bad", content: "[AI 대화 피드백]" },
      expect.any(AbortSignal),
    );
  });

  it("닫으면 7일간 숨기고 계정별로 구분하며 기간이 지나면 다시 노출한다", () => {
    const onDismiss = vi.fn();
    const view = render(card("authenticated:1", onDismiss));
    fireEvent.click(screen.getByRole("button", { name: "대화 피드백 닫기" }));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(request).not.toHaveBeenCalled();
    view.unmount();
    const suppressed = render(card());
    expect(screen.queryByRole("region")).toBeNull();
    suppressed.unmount();
    const other = render(card("authenticated:2"));
    expect(screen.getByRole("region")).toBeTruthy();
    other.unmount();
    localStorage.setItem(key, String(Date.now() - 1));
    render(card());
    expect(screen.getByRole("region")).toBeTruthy();
  });

  it("실패하면 평가·입력을 보존하고 재시도 전까지 재노출 제한을 저장하지 않는다", async () => {
    request.mockRejectedValueOnce(new Error("network"));
    render(card());
    fireEvent.click(screen.getByRole("button", { name: "아쉬웠어요" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "구체적인 안내가 필요해요" },
    });
    fireEvent.click(screen.getByRole("button", { name: "피드백 보내기" }));
    await screen.findByRole("alert");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "구체적인 안내가 필요해요",
    );
    expect(localStorage.getItem(key)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "피드백 보내기" }));
    await screen.findByRole("status");
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("전송 중에는 닫기와 중복 제출을 막고 언마운트 시 요청을 취소한다", async () => {
    let resolve!: () => void;
    request.mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const view = render(card());
    fireEvent.click(screen.getByRole("button", { name: "도움됐어요" }));
    fireEvent.click(screen.getByRole("button", { name: "피드백 보내기" }));
    expect(
      screen
        .getByRole("button", { name: "대화 피드백 닫기" })
        .hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.submit(screen.getByRole("region").querySelector("form")!);
    expect(request).toHaveBeenCalledOnce();
    const signal = request.mock.calls[0][1];
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => resolve());
    expect(localStorage.getItem(key)).toBeNull();
    expect(analyticsMocks.track).not.toHaveBeenCalled();
  });

  it("브라우저 저장소를 쓸 수 없어도 닫기와 전송은 동작한다", async () => {
    const read = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    const write = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    try {
      const view = render(card());
      fireEvent.click(screen.getByRole("button", { name: "대화 피드백 닫기" }));
      expect(screen.queryByRole("region")).toBeNull();
      view.unmount();
      render(card());
      fireEvent.click(screen.getByRole("button", { name: "도움됐어요" }));
      fireEvent.click(screen.getByRole("button", { name: "피드백 보내기" }));
      await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    } finally {
      read.mockRestore();
      write.mockRestore();
    }
  });
});
