import { useRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useModalEnvironment } from "./useModalEnvironment";
import { BottomSheet } from "../../components/bottom-sheet";

function Modal({ name, onEscape }: { name: string; onEscape?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useModalEnvironment({ rootRef: ref, onEscape, inertBackground: true });
  return (
    <div ref={ref}>
      <button type="button">{name}</button>
    </div>
  );
}

it.each(["모달", "바텀시트"])(
  "%s부터 열고 먼저 닫아도 마지막 레이어가 닫힐 때 스크롤을 복원한다",
  async (first) => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "auto";
    const layers = (modal: boolean, sheet: boolean) => (
      <>
        {modal && <Modal name="기존 모달" />}
        <BottomSheet
          open={sheet}
          onClose={() => {}}
          aria-label="신규 바텀시트"
        />
      </>
    );
    const view = render(layers(first === "모달", first === "바텀시트"));
    try {
      view.rerender(layers(true, true));
      view.rerender(layers(first !== "모달", first !== "바텀시트"));
      if (first === "바텀시트")
        await waitFor(() =>
          expect(
            screen.queryByRole("dialog", { name: "신규 바텀시트" }),
          ).toBeNull(),
        );
      expect(document.body.style.overflow).toBe("hidden");
      view.rerender(layers(false, false));
      await waitFor(() => expect(document.body.style.overflow).toBe("auto"));
    } finally {
      view.unmount();
      document.body.style.overflow = previous;
    }
  },
);

it.each([false, true])(
  "스크롤 영역이 모달 범위 자체인지(%s)에 관계없이 마지막 모달까지 잠금을 유지한다",
  (scopeIsScroll) => {
    const modals = (first: boolean, second: boolean) => (
      <>
        {first && <Modal name="첫째" />}
        {second && <Modal name="둘째" />}
      </>
    );
    const view = (first: boolean, second: boolean) => (
      <div
        data-modal-scope
        data-page-scroll-container={scopeIsScroll || undefined}
        style={scopeIsScroll ? { overflow: "auto" } : undefined}
      >
        <header data-modal-background>
          <button type="button">배경</button>
        </header>
        {scopeIsScroll ? (
          modals(first, second)
        ) : (
          <div data-page-scroll-container style={{ overflow: "auto" }}>
            {modals(first, second)}
          </div>
        )}
      </div>
    );
    const { container, rerender } = render(view(true, false));
    const scroll = container.querySelector<HTMLElement>(
      "[data-page-scroll-container]",
    )!;
    const background = container.querySelector("header")!;
    scroll.scrollTop = 300;
    rerender(view(true, true));
    rerender(view(false, true));
    expect(scroll.style.overflow).toBe("hidden");
    expect(background.hasAttribute("inert")).toBe(true);
    rerender(view(false, false));
    expect(scroll.style.overflow).toBe("auto");
    expect(background.hasAttribute("inert")).toBe(false);
    expect(scroll.scrollTop).toBe(300);
    expect(scroll.closest("[data-modal-scope]")?.hasAttribute("inert")).toBe(
      false,
    );
  },
);

it("하위 컨트롤이 처리한 Escape를 모달에서 다시 실행하지 않는다", () => {
  const close = vi.fn();
  render(<Modal name="닫기" onEscape={close} />);
  const button = screen.getByRole("button", { name: "닫기" });
  button.addEventListener("keydown", (event) => event.preventDefault(), {
    once: true,
  });
  fireEvent.keyDown(button, { key: "Escape" });
  expect(close).not.toHaveBeenCalled();
  fireEvent.keyDown(button, { key: "Escape" });
  expect(close).toHaveBeenCalledOnce();
});
