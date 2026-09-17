import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { LoginRequiredDialog } from "./LoginRequiredDialog";

function DialogHarness({ onLogin = vi.fn() }: { onLogin?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);

  return (
    <>
      <button
        onClick={(event) => {
          setTrigger(event.currentTarget);
          setIsOpen(true);
        }}
        type="button"
      >
        플래너 열기
      </button>
      {isOpen ? (
        <LoginRequiredDialog
          onClose={() => setIsOpen(false)}
          onLogin={onLogin}
          returnFocusTo={trigger}
        />
      ) : null}
    </>
  );
}

describe("LoginRequiredDialog", () => {
  it("안내와 동작을 제공하고 열릴 때 취소 버튼으로 포커스를 이동한다", () => {
    const onLogin = vi.fn();
    render(<DialogHarness onLogin={onLogin} />);

    fireEvent.click(screen.getByRole("button", { name: "플래너 열기" }));

    expect(
      screen.getByRole("dialog", { name: "로그인이 필요해요" }),
    ).toBeTruthy();
    expect(screen.getByRole("dialog").querySelector("p")?.textContent).toBe(
      "플래너를 이용하려면 로그인이 필요해요.\n로그인하고 나만의 일정과 준비 현황을 확인해 보세요.",
    );
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "취소" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(onLogin).toHaveBeenCalledOnce();
  });

  it("Tab과 Shift+Tab 포커스를 다이얼로그 안에 가둔다", () => {
    render(<DialogHarness />);
    fireEvent.click(screen.getByRole("button", { name: "플래너 열기" }));

    const cancelButton = screen.getByRole("button", { name: "취소" });
    const loginButton = screen.getByRole("button", { name: "로그인" });
    loginButton.focus();
    fireEvent.keyDown(loginButton, { key: "Tab" });
    expect(document.activeElement).toBe(cancelButton);

    fireEvent.keyDown(cancelButton, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(loginButton);
  });

  it("StrictMode의 effect 재실행 중에도 다이얼로그 포커스를 유지한다", async () => {
    render(
      <StrictMode>
        <DialogHarness />
      </StrictMode>,
    );
    fireEvent.click(screen.getByRole("button", { name: "플래너 열기" }));

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "취소" }),
      ),
    );
  });

  it.each(["cancel", "escape", "backdrop"] as const)(
    "%s 동작으로 닫고 트리거에 포커스를 복원한다",
    async (closeMethod) => {
      const { container } = render(<DialogHarness />);
      const trigger = screen.getByRole("button", { name: "플래너 열기" });
      fireEvent.click(trigger);

      if (closeMethod === "cancel") {
        fireEvent.click(screen.getByRole("button", { name: "취소" }));
      } else if (closeMethod === "escape") {
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
      } else {
        const backdrop = container.querySelector<HTMLElement>(
          ".login-required-dialog__backdrop",
        );
        expect(backdrop).not.toBeNull();
        if (backdrop) {
          fireEvent.mouseDown(backdrop);
        }
      }

      expect(screen.queryByRole("dialog")).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    },
  );
});
