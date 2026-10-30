import { createRef } from "react";
import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";
import { IconButton } from "../icon-button";
import { ListFooter } from "../list-footer";
import { HamburgerIcon } from "../icons/ActionIcons";

type InteractionProps = Pick<
  ComponentProps<typeof Button>,
  "loading" | "disabled" | "aria-disabled" | "type" | "onClick" | "ref"
>;

describe.each([
  ["Button", (props: InteractionProps) => <Button {...props}>실행</Button>],
  [
    "ListFooter",
    (props: InteractionProps) => <ListFooter {...props}>실행</ListFooter>,
  ],
  [
    "IconButton",
    (props: InteractionProps) => (
      <IconButton {...props} aria-label="실행" icon={<HamburgerIcon />} />
    ),
  ],
] as const)("%s 사용자 동작", (_name, createButton) => {
  it("ref로 초점을 이동할 수 있고 기본 클릭은 폼을 제출하지 않는다", () => {
    const ref = createRef<HTMLButtonElement>();
    const onClick = vi.fn();
    const onSubmit = vi.fn((event) => event.preventDefault());
    render(<form onSubmit={onSubmit}>{createButton({ ref, onClick })}</form>);

    const button = screen.getByRole("button", { name: "실행" });
    ref.current?.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([
    { loading: true },
    { disabled: true },
    { "aria-disabled": true },
    { "aria-disabled": "true" },
  ] as const)(
    "사용할 수 없는 상태 %j에서는 클릭과 폼 제출을 막는다",
    (state) => {
      const onClick = vi.fn();
      const onSubmit = vi.fn((event) => event.preventDefault());
      render(
        <form onSubmit={onSubmit}>
          {createButton({ ...state, type: "submit", onClick })}
        </form>,
      );

      fireEvent.click(screen.getByRole("button", { name: "실행" }));
      expect(onClick).not.toHaveBeenCalled();
      expect(onSubmit).not.toHaveBeenCalled();
    },
  );

  it("로딩 중 이름과 초점을 유지하고 로딩이 끝나면 다시 제출할 수 있다", () => {
    const onSubmit = vi.fn((event) => event.preventDefault());
    const { rerender } = render(
      <form onSubmit={onSubmit}>
        {createButton({ loading: true, type: "submit" })}
      </form>,
    );
    const button = screen.getByRole("button", { name: "실행" });
    button.focus();
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(button);
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(
      <form onSubmit={onSubmit}>
        {createButton({ loading: false, type: "submit" })}
      </form>,
    );
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
