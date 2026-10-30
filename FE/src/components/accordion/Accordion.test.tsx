import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Accordion, AccordionPrimitive as P } from "./index";

it("표준 API는 제목·설명 연결과 단일 펼침, 접은 본문의 입력값을 유지한다", () => {
  render(
    <Accordion headingLevel={2}>
      <Accordion.Item value="one" title="첫 항목" description="보충 설명">
        <input aria-label="메모" defaultValue="초기 값" />
      </Accordion.Item>
      <Accordion.Item value="two" title="둘째 항목">
        다른 내용
      </Accordion.Item>
    </Accordion>,
  );
  const first = screen.getByRole("button", { name: "첫 항목" });
  const second = screen.getByRole("button", { name: "둘째 항목" });
  expect(
    screen.getByRole("heading", { level: 2, name: /첫 항목/ }),
  ).toBeTruthy();
  expect(
    document.getElementById(first.getAttribute("aria-describedby")!)
      ?.textContent,
  ).toBe("보충 설명");
  const content = document.getElementById(
    first.getAttribute("aria-controls")!,
  )!;
  expect(content.getAttribute("aria-labelledby")).toBe(first.id);
  expect(content.hidden).toBe(true);
  fireEvent.click(first);
  const input = screen.getByRole("textbox", { name: "메모" });
  fireEvent.change(input, { target: { value: "작성 중" } });
  fireEvent.click(second);
  expect(content.hidden).toBe(true);
  fireEvent.click(first);
  expect(screen.getByRole("textbox", { name: "메모" })).toBe(input);
  expect((input as HTMLInputElement).value).toBe("작성 중");
});

it("조합 API는 여러 항목을 펼치고 요약 정보를 제목 버튼 밖에 유지한다", () => {
  const triggerRef = createRef<HTMLButtonElement>();
  const itemRef = createRef<HTMLDivElement>();
  const contentRef = createRef<HTMLDivElement>();
  render(
    <P.Root type="multiple" headingLevel={4}>
      <P.Item value="one" ref={itemRef}>
        <P.Header>
          <P.Trigger ref={triggerRef}>첫 제목</P.Trigger>
        </P.Header>
        <span>별도 요약</span>
        <P.Content ref={contentRef}>첫 내용</P.Content>
      </P.Item>
      <P.Item value="two">
        <P.Header>
          <P.Trigger>둘째 제목</P.Trigger>
        </P.Header>
        <P.Content>둘째 내용</P.Content>
      </P.Item>
    </P.Root>,
  );
  const first = screen.getByRole("button", { name: "첫 제목" });
  expect(triggerRef.current).toBe(first);
  expect(first.contains(screen.getByText("별도 요약"))).toBe(false);
  expect(itemRef.current?.contains(first)).toBe(true);
  expect(
    screen.getByRole("heading", { name: "첫 제목", level: 4 }),
  ).toBeTruthy();
  fireEvent.click(first);
  fireEvent.click(screen.getByRole("button", { name: "둘째 제목" }));
  expect(contentRef.current?.hidden).toBe(false);
  expect(first.getAttribute("aria-expanded")).toBe("true");
  expect(
    screen
      .getByRole("button", { name: "둘째 제목" })
      .getAttribute("aria-expanded"),
  ).toBe("true");
});

it("조합 API의 키보드 탐색은 비활성 항목과 중첩 그룹을 건너뛴다", () => {
  render(
    <P.Root defaultValue={["one"]}>
      <P.Item value="one">
        <P.Header>
          <P.Trigger>바깥 첫째</P.Trigger>
        </P.Header>
        <P.Content>
          <Accordion>
            <Accordion.Item value="inner" title="안쪽">
              내용
            </Accordion.Item>
          </Accordion>
        </P.Content>
      </P.Item>
      <P.Item value="disabled" aria-disabled="true">
        <P.Header>
          <P.Trigger>비활성</P.Trigger>
        </P.Header>
        <P.Content>내용</P.Content>
      </P.Item>
      <P.Item value="two">
        <P.Header>
          <P.Trigger>바깥 둘째</P.Trigger>
        </P.Header>
        <P.Content>내용</P.Content>
      </P.Item>
    </P.Root>,
  );
  const first = screen.getByRole("button", { name: "바깥 첫째" });
  const second = screen.getByRole("button", { name: "바깥 둘째" });
  const inner = screen.getByRole("button", { name: "안쪽" });
  expect(
    (screen.getByRole("button", { name: "비활성" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  first.focus();
  fireEvent.keyDown(first, { key: "ArrowDown" });
  expect(document.activeElement).toBe(second);
  fireEvent.keyDown(second, { key: "ArrowDown" });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: "End" });
  expect(document.activeElement).toBe(second);
  fireEvent.keyDown(second, { key: "Home" });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: "ArrowDown", isComposing: true });
  expect(document.activeElement).toBe(first);
  inner.focus();
  fireEvent.keyDown(inner, { key: "ArrowDown" });
  expect(document.activeElement).toBe(inner);
});

it("외부 제어로 본문을 접으면 활성 제목이나 그룹으로 초점을 복귀한다", () => {
  const changes = vi.fn();
  const groupRef = createRef<HTMLDivElement>();
  const tree = (value: string[], disabled = false, allDisabled = false) => (
    <P.Root
      ref={groupRef}
      value={value}
      onValueChange={changes}
      disabled={allDisabled}
    >
      <P.Item value="one" disabled={disabled}>
        <P.Header>
          <P.Trigger>원래 제목</P.Trigger>
        </P.Header>
        <P.Content style={{ display: "grid" }}>
          <input aria-label="사용자 메모" />
        </P.Content>
      </P.Item>
      <P.Item value="two">
        <P.Header>
          <P.Trigger>대체 제목</P.Trigger>
        </P.Header>
        <P.Content>내용</P.Content>
      </P.Item>
    </P.Root>
  );
  const view = render(tree(["one"]));
  const trigger = screen.getByRole("button", { name: "원래 제목" });
  fireEvent.click(trigger);
  expect(changes).toHaveBeenCalledExactlyOnceWith([]);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  screen.getByRole("textbox").focus();
  view.rerender(tree([]));
  expect(document.activeElement).toBe(trigger);
  expect(
    document.getElementById(trigger.getAttribute("aria-controls")!)?.style
      .display,
  ).toBe("none");
  view.rerender(tree(["one"]));
  screen.getByRole("textbox").focus();
  view.rerender(tree([], true));
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "대체 제목" }),
  );
  view.rerender(tree(["one"]));
  screen.getByRole("textbox").focus();
  view.rerender(tree([], false, true));
  expect(document.activeElement).toBe(groupRef.current);
  fireEvent.click(trigger);
  expect(changes).toHaveBeenCalledTimes(1);
});

it("사용처는 기본 클릭 동작과 키보드 탐색을 취소할 수 있다", () => {
  const changes = vi.fn();
  render(
    <P.Root
      onValueChange={changes}
      onKeyDown={(event) => event.preventDefault()}
    >
      <P.Item value="one">
        <P.Header>
          <P.Trigger onClick={(event) => event.preventDefault()}>
            첫 제목
          </P.Trigger>
        </P.Header>
        <P.Content>내용</P.Content>
      </P.Item>
      <P.Item value="two">
        <P.Header>
          <P.Trigger>둘째 제목</P.Trigger>
        </P.Header>
        <P.Content>내용</P.Content>
      </P.Item>
    </P.Root>,
  );
  const trigger = screen.getByRole("button", { name: "첫 제목" });
  fireEvent.click(trigger);
  expect(changes).not.toHaveBeenCalled();
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  expect(document.activeElement).toBe(trigger);
});
