import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";

import { ServiceLayout } from "./ServiceLayout";

describe("ServiceLayout", () => {
  it("서비스 경로가 변경되면 콘텐츠 스크롤을 맨 위로 초기화한다", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/preparation"]}>
        <Routes>
          <Route element={<ServiceLayout />}>
            <Route path="/" element={<div>홈 화면</div>} />
            <Route path="/preparation" element={<div>준비 목록 화면</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const content = container.querySelector<HTMLElement>(
      ".service-layout__content",
    );

    expect(content).not.toBeNull();
    if (!content) {
      return;
    }

    content.scrollTop = 700;

    fireEvent.click(
      within(screen.getByRole("navigation", { name: "하단 메뉴" })).getByRole(
        "link",
        { name: "홈" },
      ),
    );

    expect(screen.getByText("홈 화면")).toBeTruthy();
    expect(content.scrollTop).toBe(0);
  });
});
