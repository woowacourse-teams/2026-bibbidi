import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChecklistFeature } from "./ChecklistFeature";

const categoryNames = [
  "계획·예산",
  "양가·가족",
  "예식장",
  "스드메·촬영",
  "의상·예물",
  "청첩장·하객",
  "본식 구성·진행",
  "신혼여행",
  "신혼집·혼수",
  "웨딩 전 관리",
  "정산·감사",
];

describe("ChecklistFeature", () => {
  it("카테고리를 정의된 순서대로 heading으로 표시한다", () => {
    render(<ChecklistFeature />);

    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map(
          (heading, index) =>
            within(heading).getByText(categoryNames[index]).textContent,
        ),
    ).toEqual(categoryNames);
  });

  it("카테고리별 항목 수와 진행률을 제공한다", () => {
    render(<ChecklistFeature />);

    const planningCategory = screen
      .getByRole("heading", { name: "계획·예산" })
      .closest("section");

    expect(planningCategory).not.toBeNull();
    expect(within(planningCategory!).getByText("3개")).toBeTruthy();
    expect(
      within(planningCategory!)
        .getByRole("progressbar", { name: "계획·예산 진행률" })
        .getAttribute("aria-valuenow"),
    ).toBe("33");
    expect(within(planningCategory!).getByText("33%")).toBeTruthy();
  });

  it("할 일을 정의된 순서대로 표시한다", () => {
    render(<ChecklistFeature />);

    expect(
      screen
        .getAllByRole("listitem")
        .map(
          (item) =>
            within(item).getByText(
              /결혼예산표 계획|웨딩플래너 상담|웨딩플래너 계약|양가 부모님께 첫인사|상견례$|상견례 선물 준비|웨딩홀 투어|웨딩홀 계약|최소 보증 인원·식대 조건 확인|웨딩홀 시식|스드메 상담|스드메 계약|스튜디오 촬영 일정 예약/,
            ).textContent,
        ),
    ).toEqual([
      "결혼예산표 계획",
      "웨딩플래너 상담",
      "웨딩플래너 계약",
      "양가 부모님께 첫인사",
      "상견례",
      "상견례 선물 준비",
      "웨딩홀 투어",
      "웨딩홀 계약",
      "최소 보증 인원·식대 조건 확인",
      "웨딩홀 시식",
      "스드메 상담",
      "스드메 계약",
      "스튜디오 촬영 일정 예약",
    ]);
  });

  it("할 일의 일정과 상태를 텍스트로 제공한다", () => {
    render(<ChecklistFeature />);

    const completedTask = screen.getByText("결혼예산표 계획").closest("li");
    const inProgressTask = screen.getByText("웨딩플래너 상담").closest("li");
    const incompleteTask = screen.getByText("웨딩플래너 계약").closest("li");

    expect(completedTask).not.toBeNull();
    expect(within(completedTask!).getByText("8월 5일")).toBeTruthy();
    expect(within(completedTask!).getByText("완료")).toBeTruthy();
    expect(within(inProgressTask!).getByText("진행 중")).toBeTruthy();
    expect(within(incompleteTask!).getByText("일정 없음")).toBeTruthy();
    expect(within(incompleteTask!).getByText("미완료")).toBeTruthy();
  });

  it("카테고리를 열고 닫는다", () => {
    render(<ChecklistFeature />);

    const planningButton = screen.getByRole("button", { name: "계획·예산" });
    const outfitButton = screen.getByRole("button", { name: "의상·예물" });

    expect(planningButton.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("결혼예산표 계획")).toBeTruthy();
    expect(outfitButton.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(planningButton);

    expect(planningButton.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("list", { name: "계획·예산 할 일" })).toBeNull();

    fireEvent.click(planningButton);

    expect(planningButton.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("list", { name: "계획·예산 할 일" })).toBeTruthy();
  });
});
