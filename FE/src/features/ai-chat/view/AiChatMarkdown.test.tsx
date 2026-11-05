import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AiChatMarkdown } from "./AiChatMarkdown";

afterEach(cleanup);

describe("AI 답변 마크다운", () => {
  it("기본 서식과 표·읽기 전용 체크리스트·취소선을 표시한다", () => {
    const { container } = render(
      <AiChatMarkdown
        text={[
          "# 결혼 준비",
          "",
          "**예산**과 *일정*, `예약`을 확인해요.",
          "",
          "- 웨딩홀",
          "  - 방문 상담",
          "",
          "1. 날짜 정하기",
          "2. 계약하기",
          "",
          "> 여유 있게 준비해요.",
          "",
          "~~이전 일정~~",
          "",
          "- [x] 예산 정하기",
          "- [ ] 방문하기",
          "",
          "| 항목 | 비용 |",
          "| :--- | ---: |",
          "| 대관 | 100만 원 |",
          "",
          "```ts",
          "const budget = 100;",
          "```",
        ].join("\n")}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "결혼 준비", level: 1 }),
    ).toBeTruthy();
    expect(screen.getByText("예산").tagName).toBe("STRONG");
    expect(screen.getByText("일정").tagName).toBe("EM");
    expect(screen.getByText("예약").tagName).toBe("CODE");
    expect(container.querySelector("ul ul")?.textContent).toContain(
      "방문 상담",
    );
    expect(container.querySelectorAll("ol > li")).toHaveLength(2);
    expect(container.querySelector("blockquote")?.textContent).toContain(
      "여유 있게",
    );
    expect(screen.getByText("이전 일정").tagName).toBe("DEL");
    const checkboxes = screen.getAllByRole<HTMLInputElement>("checkbox");
    expect(checkboxes.map((checkbox) => checkbox.checked)).toEqual([
      true,
      false,
    ]);
    expect(checkboxes.every((checkbox) => checkbox.disabled)).toBe(true);
    const table = within(screen.getByRole("table"));
    expect(table.getByRole("columnheader", { name: "항목" })).toBeTruthy();
    expect(table.getByRole("cell", { name: "100만 원" })).toBeTruthy();
    expect(
      table.getByRole("columnheader", { name: "비용" }).style.textAlign,
    ).toBe("right");
    expect(screen.getByRole("region", { name: "AI 답변 표" }).tabIndex).toBe(0);
    const code = screen.getByText("const budget = 100;");
    expect(code.tagName).toBe("CODE");
    expect(code.parentElement?.tagName).toBe("PRE");
    expect(code.parentElement?.tabIndex).toBe(0);
  });

  it("링크는 새 탭에서 열고 위험한 주소는 그대로 전달하지 않는다", () => {
    render(
      <AiChatMarkdown
        text={
          "[안내](https://example.com/wedding)\n\n[위험](javascript:alert%281%29)"
        }
      />,
    );
    const link = screen.getByRole("link", { name: "안내" });
    expect(link.getAttribute("href")).toBe("https://example.com/wedding");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText("위험").getAttribute("href") ?? "").not.toContain(
      "javascript:",
    );
  });

  it("응답의 HTML과 스크립트는 실행 가능한 요소로 만들지 않는다", () => {
    const html =
      '<img src="x" onerror="alert(1)">\n\n<script>alert(1)</script>';
    const { container } = render(<AiChatMarkdown text={html} />);
    expect(container.querySelector("img, script, [onerror]")).toBeNull();
    expect(container.textContent).toContain('<img src="x" onerror="alert(1)">');
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });
});
