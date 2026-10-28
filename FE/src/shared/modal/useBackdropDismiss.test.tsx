import { useState, type MouseEventHandler } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BottomSheet } from "../../components/bottom-sheet";
import { Dialog } from "../../components/dialog";
import { PanelOverlay } from "../../components/panel-overlay";

const kinds = ["dialog", "bottom-sheet", "panel-overlay"] as const;
type Kind = (typeof kinds)[number];
function Layer({
  kind,
  onClose,
  onInsideClick,
  onClick,
  closeOnDimmerClick = true,
}: {
  kind: Kind;
  onClose: () => void;
  onInsideClick?: () => void;
  onClick?: MouseEventHandler<HTMLDialogElement>;
  closeOnDimmerClick?: boolean;
}) {
  const common = { open: true, onClose, onClick, closeOnDimmerClick };
  const content = <button onClick={onInsideClick}>내부 선택</button>;
  if (kind === "dialog")
    return (
      <Dialog
        {...common}
        title={<Dialog.Title>단계 상세</Dialog.Title>}
        actions={null}
      >
        {content}
      </Dialog>
    );
  if (kind === "bottom-sheet")
    return (
      <BottomSheet
        {...common}
        header={<BottomSheet.Header>단계 상세</BottomSheet.Header>}
      >
        {content}
      </BottomSheet>
    );
  return (
    <PanelOverlay {...common} aria-label="단계 상세">
      {content}
    </PanelOverlay>
  );
}

function pointer(target: HTMLElement, type: string, button = 0) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button,
  });
  Object.assign(event, { pointerType: "touch", pointerId: 1, isPrimary: true });
  fireEvent(target, event);
}

describe.each(kinds)("공통 모달 배경 입력: %s", (kind) => {
  it("터치의 click까지 모달을 유지하고 뒤 화면으로 전파하지 않는다", () => {
    const backgroundClick = vi.fn();
    function Screen() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button onClick={backgroundClick}>배경 이동</button>
          {open && <Layer kind={kind} onClose={() => setOpen(false)} />}
        </>
      );
    }
    render(<Screen />);
    const bubbled = vi.fn();
    document.addEventListener("click", bubbled);
    try {
      const layer = screen.getByRole("dialog", { name: "단계 상세" });
      pointer(layer, "pointerdown");
      pointer(layer, "pointerup");
      expect(layer.isConnected).toBe(true);
      expect((layer as HTMLDialogElement).open).toBe(true);
      expect(fireEvent.click(layer)).toBe(false);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(bubbled).not.toHaveBeenCalled();
      expect(backgroundClick).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "배경 이동" }));
      expect(backgroundClick).toHaveBeenCalledOnce();
    } finally {
      document.removeEventListener("click", bubbled);
    }
  });

  it("내부 조작, 취소된 포인터, 보조 버튼 입력은 닫기로 처리하지 않는다", () => {
    const onClose = vi.fn();
    const onInsideClick = vi.fn();
    render(
      <Layer kind={kind} onClose={onClose} onInsideClick={onInsideClick} />,
    );
    const layer = screen.getByRole("dialog");
    const inside = screen.getByRole("button", { name: "내부 선택" });
    pointer(inside, "pointerdown");
    pointer(layer, "pointerup");
    fireEvent.click(layer);
    pointer(layer, "pointerdown");
    pointer(layer, "pointercancel");
    pointer(layer, "pointerup");
    fireEvent.click(layer);
    pointer(layer, "pointerdown", 2);
    pointer(layer, "pointerup", 2);
    fireEvent.click(layer);
    fireEvent.click(inside);
    expect(onInsideClick).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("사용처에서 취소한 click은 닫기 요청으로 바꾸지 않는다", () => {
    const onClose = vi.fn();
    render(
      <Layer
        kind={kind}
        onClose={onClose}
        onClick={(event) => event.preventDefault()}
      />,
    );
    const layer = screen.getByRole("dialog");
    pointer(layer, "pointerdown");
    pointer(layer, "pointerup");
    fireEvent.click(layer);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("닫기가 제한된 배경 입력은 소비하고 모달을 유지한다", () => {
    const onClose = vi.fn();
    render(<Layer kind={kind} onClose={onClose} closeOnDimmerClick={false} />);
    const layer = screen.getByRole("dialog");
    pointer(layer, "pointerdown");
    pointer(layer, "pointerup");
    expect(fireEvent.click(layer)).toBe(false);
    expect((layer as HTMLDialogElement).open).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });
});
