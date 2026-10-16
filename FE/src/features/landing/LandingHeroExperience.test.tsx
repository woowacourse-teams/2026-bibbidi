import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LandingHeroExperience } from "./LandingHeroExperience";

describe("LandingHeroExperience", () => {
  it("AI 카드에서 질문을 고르고 다른 질문의 답변과 추천도 확인한다", () => {
    render(<LandingHeroExperience motionDisabled={false} />);
    fireEvent.click(screen.getByRole("button", { name: "비비디 AI 체험하기" }));
    fireEvent.click(
      screen.getByRole("button", { name: "웨딩홀을 정한 다음엔 뭘 준비할까?" }),
    );
    expect(
      screen.getByRole("heading", { name: "주례 없는 예식 순서 정하기" }),
    ).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "다른 질문 해보기" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "다른 질문 해보기" }));
    fireEvent.click(
      screen.getByRole("button", { name: "촬영 전에 준비할 일을 정리해줘" }),
    );
    expect(screen.getByText(/촬영을 앞두고 계시군요!/)).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "촬영 콘셉트 정하기" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "주례 없는 예식 순서 정하기" }),
    ).toBeNull();
  });

  it("움직임을 꺼도 체크 완료와 취소가 가능하고 탭 이동 후 상태를 유지한다", () => {
    render(<LandingHeroExperience motionDisabled />);
    fireEvent.click(
      screen.getByRole("button", { name: "나의 체크리스트 체험하기" }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "웨딩홀 투어 예약하기" }),
    );
    expect(screen.getByRole("progressbar").getAttribute("value")).toBe("1");
    expect(screen.getByRole("status").textContent).toContain("완료했어요!");
    fireEvent.click(screen.getByRole("button", { name: "캘린더" }));
    fireEvent.click(screen.getByRole("button", { name: "체크리스트" }));
    expect(
      (
        screen.getByRole("checkbox", {
          name: "웨딩홀 투어 예약하기",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "웨딩홀 투어 예약하기" }),
    );
    expect(screen.getByRole("progressbar").getAttribute("value")).toBe("0");
    fireEvent.click(
      screen.getByRole("checkbox", { name: "예식 진행 순서 정하기" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "체험 초기화" }));
    expect(screen.getByRole("progressbar").getAttribute("value")).toBe("0");
  });

  it("캘린더에서 일정이 있는 날과 빈 날짜를 확인하고 초기화한다", () => {
    render(<LandingHeroExperience motionDisabled />);
    fireEvent.click(screen.getByRole("button", { name: "캘린더" }));
    expect(screen.getByText("웨딩홀 투어")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "10월 23일, 촬영 의상 피팅 일정" }),
    );
    expect(screen.getByText("촬영 의상 피팅")).toBeTruthy();
    expect(screen.getByText("14:00 · 예시 일정")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "10월 22일" }));
    expect(screen.getByText("등록된 예시 일정이 없어요.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "체험 초기화" }));
    expect(
      screen
        .getByRole("button", { name: "10월 18일, 웨딩홀 투어 일정" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByText("웨딩홀 투어")).toBeTruthy();
  });
});
