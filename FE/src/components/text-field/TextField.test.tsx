import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextField } from "./TextField";

describe("TextField의 접근성 설명", () => {
  it("입력과 선택 버튼의 숨긴 라벨은 값이 있어도 숨김 상태와 접근성 이름을 유지한다", () => {
    const view = render(
      <TextField
        label="할 일 제목"
        labelHidden
        value="방문 일정"
        onChange={() => {}}
      />,
    );
    const input = screen.getByRole("textbox", { name: "할 일 제목" });
    expect(document.querySelector("label")?.hasAttribute("data-hidden")).toBe(
      true,
    );
    expect(input.hasAttribute("labelHidden")).toBe(false);
    view.rerender(
      <TextField.Button label="날짜" labelHidden value="10월 26일" />,
    );
    const button = screen.getByRole("button", { name: "날짜 10월 26일" });
    expect(document.querySelector("label")?.hasAttribute("data-hidden")).toBe(
      true,
    );
    expect(button.hasAttribute("labelHidden")).toBe(false);
    view.rerender(<TextField.Button label="날짜" value="10월 26일" />);
    expect(document.querySelector("label")?.hasAttribute("data-hidden")).toBe(
      false,
    );
  });

  it("선택 버튼의 필수 안내·외부 설명·오류 메시지를 함께 연결한다", () => {
    render(
      <>
        <p id="date-hint">예약할 날짜를 선택하세요.</p>
        <TextField.Button
          label="날짜"
          placeholder="날짜 선택"
          required
          hasError
          aria-describedby="date-hint"
          help={<span role="alert">날짜를 선택해 주세요.</span>}
        />
      </>,
    );
    const button = screen.getByRole("button", {
      name: "날짜 날짜 선택",
      description:
        "필수 항목입니다. 예약할 날짜를 선택하세요. 날짜를 선택해 주세요.",
    });
    expect(button.hasAttribute("aria-required")).toBe(false);
    expect(button.hasAttribute("aria-invalid")).toBe(false);
    expect(screen.getByRole("alert").textContent).toBe("날짜를 선택해 주세요.");
  });

  it("필수와 오류가 해제되면 설명에서도 제거하고 외부 설명은 유지한다", () => {
    const field = (required: boolean, error?: string) => (
      <>
        <p id="time-hint">시간은 생략할 수 있습니다.</p>
        <TextField.Button
          label="시작 시간"
          value="09:13"
          required={required}
          hasError={!!error}
          aria-describedby="time-hint"
          help={error}
        />
      </>
    );
    const view = render(field(true, "시간을 확인해 주세요."));
    expect(
      screen.getByRole("button", {
        name: "시작 시간 09:13",
        description:
          "필수 항목입니다. 시간은 생략할 수 있습니다. 시간을 확인해 주세요.",
      }),
    ).toBeTruthy();
    view.rerender(field(false));
    expect(
      screen.getByRole("button", {
        name: "시작 시간 09:13",
        description: "시간은 생략할 수 있습니다.",
      }),
    ).toBeTruthy();
    expect(screen.queryByText("필수 항목입니다.")).toBeNull();
    expect(screen.queryByText("시간을 확인해 주세요.")).toBeNull();
  });

  it("일반 입력은 네이티브 필수·오류 상태와 도움말을 유지한다", () => {
    render(
      <TextField label="제목" required hasError help="제목을 입력해 주세요." />,
    );
    const input = screen.getByRole("textbox", {
      name: "제목",
      description: "제목을 입력해 주세요.",
    }) as HTMLInputElement;
    expect(input.required).toBe(true);
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });
});
