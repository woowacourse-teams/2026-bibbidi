import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "../button";
import { Menu } from "./Menu";

describe("Menu", () => {
  it("트리거 ref를 전달하고 방향키·Home·End·문자 검색으로 활성 항목만 이동한다", () => {
    const ref = vi.fn();
    render(
      <Menu aria-label="편집" trigger={<Button ref={ref}>열기</Button>}>
        <Menu.Item>수정</Menu.Item>
        <Menu.Item disabled>복사</Menu.Item>
        <Menu.Item tone="critical">삭제</Menu.Item>
      </Menu>,
    );
    const trigger = screen.getByRole("button", { name: "열기" });
    expect(ref).toHaveBeenCalledWith(trigger);
    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    const edit = screen.getByRole("menuitem", { name: "수정" });
    const remove = screen.getByRole("menuitem", { name: "삭제" });
    expect(document.activeElement).toBe(remove);
    fireEvent.keyDown(remove, { key: "ArrowDown" });
    expect(document.activeElement).toBe(edit);
    fireEvent.keyDown(edit, { key: "End" });
    expect(document.activeElement).toBe(remove);
    fireEvent.keyDown(remove, { key: "Home" });
    expect(document.activeElement).toBe(edit);
    fireEvent.keyDown(edit, { key: "삭" });
    expect(document.activeElement).toBe(remove);
    fireEvent.keyDown(remove, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("항목 선택을 취소할 수 있고 정상 선택은 메뉴를 닫고 액션을 한 번 실행한다", () => {
    const onSelect = vi.fn();
    render(
      <Menu aria-label="편집" trigger={<Button>열기</Button>}>
        <Menu.Item
          onClick={(event) => event.preventDefault()}
          onSelect={onSelect}
        >
          저장 보류
        </Menu.Item>
        <Menu.Item onSelect={onSelect}>저장</Menu.Item>
      </Menu>,
    );
    fireEvent.click(screen.getByRole("button", { name: "열기" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "저장 보류" }));
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("menuitem", { name: "저장" }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "열기" }),
    );
  });

  it("체크 항목은 상태를 바꿔도 메뉴와 초점을 유지한다", () => {
    function Harness() {
      const [checked, setChecked] = useState(false);
      return (
        <Menu aria-label="보기" trigger={<Button>열기</Button>}>
          <Menu.CheckboxItem checked={checked} onCheckedChange={setChecked}>
            완료 포함
          </Menu.CheckboxItem>
        </Menu>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "열기" }));
    const item = screen.getByRole("menuitemcheckbox", { name: "완료 포함" });
    fireEvent.click(item);
    expect(item.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(item);
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("비활성화 후 다시 활성화해도 이전 메뉴가 다시 열리지 않는다", () => {
    const { rerender } = render(
      <Menu aria-label="편집" defaultOpen trigger={<Button>열기</Button>}>
        <Menu.Item>수정</Menu.Item>
      </Menu>,
    );
    expect(screen.getByRole("menu")).toBeTruthy();
    rerender(
      <Menu aria-label="편집" disabled trigger={<Button>열기</Button>}>
        <Menu.Item>수정</Menu.Item>
      </Menu>,
    );
    expect(screen.queryByRole("menu")).toBeNull();
    rerender(
      <Menu aria-label="편집" trigger={<Button>열기</Button>}>
        <Menu.Item>수정</Menu.Item>
      </Menu>,
    );
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("바깥 클릭은 트리거로 복귀하고 바깥 초점 이동은 새 초점을 유지한다", () => {
    render(
      <>
        <Menu aria-label="편집" trigger={<Button>열기</Button>}>
          <Menu.Item>수정</Menu.Item>
        </Menu>
        <Button>다음</Button>
      </>,
    );
    const trigger = screen.getByRole("button", { name: "열기" });
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    const next = screen.getByRole("button", { name: "다음" });
    act(() => next.focus());
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(next);
  });

  it("모달의 마지막 트리거에서 Tab을 누르면 메뉴를 닫고 모달 처음으로 순환한다", () => {
    render(
      <div role="dialog" aria-modal="true" aria-label="상세">
        <Button>처음</Button>
        <Menu aria-label="편집" trigger={<Button>열기</Button>}>
          <Menu.Item>수정</Menu.Item>
        </Menu>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "열기" }));
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "수정" }), {
      key: "Tab",
    });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "처음" }),
    );
  });
});
