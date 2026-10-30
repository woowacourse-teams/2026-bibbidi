import { useState } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BottomSheet } from "./BottomSheet";

function Harness({
  dismissible = true,
  handleOnly = false,
}: {
  dismissible?: boolean;
  handleOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        날짜 선택 열기
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        closeOnEscape={dismissible}
        closeOnBackdrop={dismissible}
        disableChildrenDragging={handleOnly}
        header={<BottomSheet.Header>날짜 선택</BottomSheet.Header>}
        cta={
          <BottomSheet.CTA onClick={() => setOpen(false)}>확인</BottomSheet.CTA>
        }
      >
        <p>본문 설명</p>
        <div data-bottom-sheet-no-drag>드래그 제외 영역</div>
        <div role="listbox" aria-label="시간 선택 영역" tabIndex={0}>
          <button type="button" role="option" aria-selected="true">
            01
          </button>
        </div>
        <label>
          메모
          <input />
        </label>
      </BottomSheet>
    </>
  );
}

describe("디자인 시스템 BottomSheet", () => {
  it("Select는 공용 라디오로 단일 선택을 유지하고 비활성 항목을 제외한다", () => {
    function Selection() {
      const [value, setValue] = useState("visit");
      return (
        <BottomSheet.Select
          aria-label="상담 방식"
          value={value}
          onChange={setValue}
          options={[
            { name: "방문 상담", value: "visit" },
            { name: "전화 상담", value: "phone" },
            { name: "영상 상담", value: "video", disabled: true },
          ]}
        />
      );
    }
    render(<Selection />);
    const visit = screen.getByRole("radio", {
      name: "방문 상담",
    }) as HTMLInputElement;
    const phone = screen.getByRole("radio", {
      name: "전화 상담",
    }) as HTMLInputElement;
    const video = screen.getByRole("radio", {
      name: "영상 상담",
    }) as HTMLInputElement;
    expect(visit.checked).toBe(true);
    fireEvent.click(phone);
    expect(phone.checked).toBe(true);
    expect(visit.checked).toBe(false);
    expect(video.disabled).toBe(true);
  });

  const touch = (clientY: number) => ({ identifier: 1, clientX: 100, clientY });
  const pull = (target: HTMLElement) => {
    fireEvent.touchStart(target, { touches: [touch(100)] });
    const allowed = fireEvent.touchMove(target, { touches: [touch(240)] });
    fireEvent.touchEnd(target, { touches: [], changedTouches: [touch(240)] });
    return allowed;
  };

  it.each(["제목", "본문"])(
    "%s을 터치로 끌어도 시트가 따라 내려가 닫힌다",
    async (area) => {
      render(<Harness />);
      fireEvent.click(screen.getByRole("button", { name: "날짜 선택 열기" }));
      const target =
        area === "제목"
          ? screen.getByRole("heading", { name: "날짜 선택" })
          : screen.getByText("본문 설명");
      expect(pull(target)).toBe(false);
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "날짜 선택" })).toBeNull(),
      );
    },
  );

  it("입력·선택·버튼·지정한 제외 영역의 터치 조작을 가로채지 않는다", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "날짜 선택 열기" }));
    for (const target of [
      screen.getByLabelText("메모"),
      screen.getByRole("listbox", { name: "시간 선택 영역" }),
      screen.getByRole("button", { name: "확인" }),
      screen.getByText("드래그 제외 영역"),
    ]) {
      expect(pull(target)).toBe(true);
      expect(
        screen
          .getByRole("dialog", { name: "날짜 선택" })
          .style.getPropertyValue("--bottom-sheet-drag-offset"),
      ).toBe("0px");
    }
  });

  it("스크롤된 본문과 위로 미는 동작은 스크롤에 맡기고 취소 시 복원한다", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "날짜 선택 열기" }));
    const target = screen.getByText("본문 설명");
    const body = target.parentElement!;
    body.scrollTop = 40;
    expect(pull(target)).toBe(true);
    body.scrollTop = 0;
    fireEvent.touchStart(target, { touches: [touch(100)] });
    expect(fireEvent.touchMove(target, { touches: [touch(50)] })).toBe(true);
    fireEvent.touchEnd(target, { touches: [], changedTouches: [touch(50)] });
    fireEvent.touchStart(target, { touches: [touch(100)] });
    expect(fireEvent.touchMove(target, { touches: [touch(140)] })).toBe(false);
    const dialog = screen.getByRole("dialog", { name: "날짜 선택" });
    expect(dialog.style.getPropertyValue("--bottom-sheet-drag-offset")).toBe(
      "40px",
    );
    fireEvent.touchCancel(target, {
      touches: [],
      changedTouches: [touch(140)],
    });
    expect(dialog.style.getPropertyValue("--bottom-sheet-drag-offset")).toBe(
      "0px",
    );
  });

  it("핸들 전용 모드에서는 제목·본문 드래그를 무시한다", () => {
    render(<Harness handleOnly />);
    fireEvent.click(screen.getByRole("button", { name: "날짜 선택 열기" }));
    expect(pull(screen.getByRole("heading", { name: "날짜 선택" }))).toBe(true);
    expect(pull(screen.getByText("본문 설명"))).toBe(true);
    expect(screen.getByRole("dialog", { name: "날짜 선택" })).toBeTruthy();
  });
  it("핸들의 짧은 드래그는 복원하고 긴 드래그만 닫는다", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "날짜 선택 열기" });
    trigger.focus();
    fireEvent.click(trigger);
    const handle = screen.getByRole("button", { name: "아래로 밀어 닫기" });
    const pointer = (type: string, clientY: number) => {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, {
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        clientX: 0,
        clientY,
      });
      fireEvent(handle, event);
    };
    pointer("pointerdown", 100);
    pointer("pointermove", 125);
    pointer("pointerup", 125);
    expect(screen.getByRole("dialog", { name: "날짜 선택" })).toBeTruthy();
    pointer("pointerdown", 100);
    pointer("pointermove", 220);
    pointer("pointerup", 220);
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "날짜 선택" })).toBeNull(),
    );
    expect(document.activeElement).toBe(trigger);
  });

  it("키보드 표시 영역과 위치를 반영하고 완료 콜백을 호출한다", async () => {
    const viewport = Object.assign(new EventTarget(), {
      height: 640,
      offsetTop: 0,
    });
    vi.stubGlobal("visualViewport", viewport);
    const onEntered = vi.fn();
    const onExited = vi.fn();
    const props = {
      onClose: vi.fn(),
      hasTextField: true,
      onEntered,
      onExited,
      "aria-label": "입력",
    };
    const view = render(<BottomSheet {...props} open />);
    try {
      const dialog = screen.getByRole("dialog", { name: "입력" });
      await waitFor(() => expect(onEntered).toHaveBeenCalledOnce());
      act(() => {
        viewport.height = 340;
        viewport.offsetTop = 20;
        viewport.dispatchEvent(new Event("resize"));
      });
      expect(
        dialog.style.getPropertyValue("--bottom-sheet-viewport-height"),
      ).toBe("340px");
      expect(dialog.style.getPropertyValue("--bottom-sheet-viewport-top")).toBe(
        "20px",
      );
      view.rerender(<BottomSheet {...props} open={false} />);
      await waitFor(() => expect(onExited).toHaveBeenCalledOnce());
    } finally {
      view.unmount();
      vi.unstubAllGlobals();
    }
  });
  it("닫기 애니메이션이 끝날 때 모달과 스크롤 잠금을 해제하고 초점을 복귀한다", async () => {
    const previousOverflow = document.body.style.overflow;
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "날짜 선택 열기" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", {
      name: "날짜 선택",
    }) as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    let finishAnimation!: () => void;
    const finished = new Promise<void>((resolve) => {
      finishAnimation = resolve;
    });
    Object.defineProperty(dialog.firstElementChild, "getAnimations", {
      value: () => [{ finished }],
    });
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(dialog.open).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    await act(async () => finishAnimation());
    expect(dialog.open).toBe(false);
    expect(document.body.style.overflow).toBe(previousOverflow);
    expect(document.activeElement).toBe(trigger);
  });

  it("본문에서 시작한 포인터 동작은 유지하고 배경에서 시작·종료한 동작만 닫는다", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "날짜 선택 열기" }));
    const dialog = screen.getByRole("dialog", { name: "날짜 선택" });
    fireEvent.pointerDown(screen.getByLabelText("메모"));
    fireEvent.pointerUp(dialog);
    fireEvent.click(dialog);
    expect((dialog as HTMLDialogElement).open).toBe(true);
    fireEvent.pointerDown(dialog, { isPrimary: true });
    fireEvent.pointerUp(dialog);
    expect((dialog as HTMLDialogElement).open).toBe(true);
    fireEvent.click(dialog);
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "날짜 선택" })).toBeNull(),
    );
  });

  it("X 버튼 없이 배경·Escape를 막아도 핸들의 키보드 실행으로 닫을 수 있다", async () => {
    render(<Harness dismissible={false} />);
    fireEvent.click(screen.getByRole("button", { name: "날짜 선택 열기" }));
    const dialog = screen.getByRole("dialog", { name: "날짜 선택" });
    fireEvent.keyDown(screen.getByLabelText("메모"), { key: "Escape" });
    fireEvent.pointerDown(dialog, { isPrimary: true });
    fireEvent.pointerUp(dialog);
    fireEvent.click(dialog);
    expect((dialog as HTMLDialogElement).open).toBe(true);
    expect(screen.queryByRole("button", { name: "닫기" })).toBeNull();
    const handle = screen.getByRole("button", { name: "아래로 밀어 닫기" });
    fireEvent.click(handle, { detail: 1 });
    expect((dialog as HTMLDialogElement).open).toBe(true);
    fireEvent.click(handle, { detail: 0 });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "날짜 선택" })).toBeNull(),
    );
  });
});

it("드래그 닫기는 끌어 내린 위치에서 퇴장하고 다시 열 때만 위치를 초기화한다", async () => {
  render(<Harness />);
  const trigger = screen.getByRole("button", { name: "날짜 선택 열기" });
  trigger.focus();
  fireEvent.click(trigger);
  const layer = screen.getByRole("dialog", { name: "날짜 선택" });
  const handle = screen.getByRole("button", { name: "아래로 밀어 닫기" });
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  Object.defineProperty(layer.firstElementChild, "getAnimations", {
    configurable: true,
    value: () => [{ finished }],
  });
  const touch = (clientY: number) => ({ identifier: 1, clientX: 100, clientY });
  const panel = layer.firstElementChild as HTMLElement;
  panel.style.transform = "matrix(1, 0, 0, 1, 0, 20)";
  fireEvent.touchStart(handle, { touches: [touch(100)] });
  fireEvent.touchMove(handle, { touches: [touch(240)] });
  fireEvent.touchEnd(handle, { touches: [], changedTouches: [touch(240)] });
  expect(layer.dataset.state).toBe("closing");
  expect(panel.style.getPropertyValue("--bottom-sheet-exit-transform")).toBe(
    "matrix(1, 0, 0, 1, 0, 20)",
  );
  expect(layer.style.getPropertyValue("--bottom-sheet-drag-offset")).toBe(
    "140px",
  );
  expect(document.body.style.overflow).toBe("hidden");
  await act(async () => finish());
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  fireEvent.click(trigger);
  expect(
    screen
      .getByRole("dialog", { name: "날짜 선택" })
      .style.getPropertyValue("--bottom-sheet-drag-offset"),
  ).toBe("0px");
});

it("제어하는 화면이 드래그 닫기를 거절하면 원래 위치로 복귀한다", async () => {
  const onClose = vi.fn();
  render(
    <BottomSheet
      open
      onClose={onClose}
      header={<BottomSheet.Header>상세</BottomSheet.Header>}
    >
      내용
    </BottomSheet>,
  );
  const handle = screen.getByRole("button", { name: "아래로 밀어 닫기" });
  const touch = (clientY: number) => ({ identifier: 1, clientX: 100, clientY });
  fireEvent.touchStart(handle, { touches: [touch(100)] });
  fireEvent.touchMove(handle, { touches: [touch(240)] });
  fireEvent.touchEnd(handle, { touches: [], changedTouches: [touch(240)] });
  await act(async () => {});
  expect(onClose).toHaveBeenCalledOnce();
  const layer = screen.getByRole("dialog", { name: "상세" });
  expect(layer.dataset.state).toBe("open");
  expect(layer.style.getPropertyValue("--bottom-sheet-drag-offset")).toBe(
    "0px",
  );
});
