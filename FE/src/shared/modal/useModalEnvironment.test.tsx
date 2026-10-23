import { useRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useModalEnvironment } from "./useModalEnvironment";

function Modal({ name, onEscape }: { name: string; onEscape?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useModalEnvironment({ rootRef: ref, onEscape, inertBackground: true });
  return (
    <div ref={ref}>
      <button type="button">{name}</button>
    </div>
  );
}

it("동시에 열린 모달이 모두 닫힐 때까지 스크롤과 배경 잠금을 유지한다", () => {
  const view = (first: boolean, second: boolean) => (
    <div data-modal-scope>
      <header data-modal-background>
        <button type="button">배경</button>
      </header>
      <div data-page-scroll-container style={{ overflow: "auto" }}>
        {first && <Modal name="첫째" />}
        {second && <Modal name="둘째" />}
      </div>
    </div>
  );
  const { container, rerender } = render(view(true, false));
  const scroll = container.querySelector<HTMLElement>(
    "[data-page-scroll-container]",
  )!;
  const background = container.querySelector("header")!;
  rerender(view(true, true));
  rerender(view(false, true));
  expect(scroll.style.overflow).toBe("hidden");
  expect(background.hasAttribute("inert")).toBe(true);
  rerender(view(false, false));
  expect(scroll.style.overflow).toBe("auto");
  expect(background.hasAttribute("inert")).toBe(false);
});

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
