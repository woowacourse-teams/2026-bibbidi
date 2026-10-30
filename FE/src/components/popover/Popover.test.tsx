import { createRef, useLayoutEffect, useRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Popover } from "./Popover";
import { Button } from "../button";
import { ListRow } from "../list-row";

describe("Popover의 입력과 초점", () => {
  it("다른 레이어로 교체될 때 새 레이어의 초점을 바깥 클릭으로 처리하지 않는다", () => {
    const onOpenChange = vi.fn();
    function Replacement() {
      const ref = useRef<HTMLButtonElement>(null);
      useLayoutEffect(() => ref.current?.focus(), []);
      return <button ref={ref}>새 레이어</button>;
    }
    const view = render(
      <Popover
        title="설정"
        trigger={<Button>설정 열기</Button>}
        open
        onOpenChange={onOpenChange}
      />,
    );
    onOpenChange.mockClear();
    view.rerender(<Replacement />);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "새 레이어" }),
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("트리거 ref와 입력 초점을 연결하고 Tab 입력으로 패널을 닫지 않는다", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    const inputRef = createRef<HTMLInputElement>();
    render(
      <Popover
        title="설정"
        trigger={<Button ref={triggerRef}>설정 열기</Button>}
        initialFocusRef={inputRef}
      >
        <label>
          이름
          <input ref={inputRef} />
        </label>
        <Popover.Close>완료</Popover.Close>
      </Popover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "설정 열기" }));
    expect(document.activeElement).toBe(inputRef.current);
    fireEvent.keyDown(inputRef.current!, { key: "Tab" });
    expect(screen.getByRole("dialog", { name: "설정" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "완료" }));
    expect(screen.queryByRole("dialog", { name: "설정" })).toBeNull();
    expect(document.activeElement).toBe(triggerRef.current);
  });

  it("입력 확인에 실패하면 Close의 닫기 이벤트를 취소할 수 있다", () => {
    render(
      <Popover title="설정" trigger={<Button>설정 열기</Button>}>
        <Popover.Close onClick={(event) => event.preventDefault()}>
          저장
        </Popover.Close>
      </Popover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "설정 열기" }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(screen.getByRole("dialog", { name: "설정" })).toBeTruthy();
  });

  it("트리거 비활성화 후 다시 활성화해도 이전 열린 상태를 되살리지 않는다", () => {
    const { rerender } = render(
      <Popover title="설정" defaultOpen trigger={<Button>설정 열기</Button>} />,
    );
    expect(screen.getByRole("dialog", { name: "설정" })).toBeTruthy();
    rerender(
      <Popover title="설정" disabled trigger={<Button>설정 열기</Button>} />,
    );
    expect(screen.queryByRole("dialog", { name: "설정" })).toBeNull();
    rerender(<Popover title="설정" trigger={<Button>설정 열기</Button>} />);
    expect(screen.queryByRole("dialog", { name: "설정" })).toBeNull();
  });

  it("정적 ListRow 안의 독립 버튼을 조작해도 패널을 유지한다", () => {
    const onAction = vi.fn();
    render(
      <Popover title="설정" trigger={<Button>설정 열기</Button>}>
        <ListRow
          contents={<ListRow.Texts top="알림" />}
          right={<Button onClick={onAction}>변경</Button>}
        />
      </Popover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "설정 열기" }));
    const action = screen.getByRole("button", { name: "변경" });
    expect(action.parentElement?.closest("button")).toBeNull();
    fireEvent.click(action);
    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog", { name: "설정" })).toBeTruthy();
  });
});
