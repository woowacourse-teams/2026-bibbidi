import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePageScrollContainer } from "./usePageScrollContainer";

function Layer() {
  const { ref, environment } = usePageScrollContainer();
  return (
    <div ref={ref}>
      <output aria-label="스크롤 영역">
        {environment?.scrollContainer?.id ?? "없음"}
      </output>
    </div>
  );
}
describe("서비스 스크롤 영역 연결", () => {
  it("다른 레이아웃의 영역 대신 소속 범위의 스크롤 영역을 찾는다", () => {
    render(
      <>
        <div data-modal-scope>
          <div data-page-scroll-container id="other" />
        </div>
        <div data-modal-scope>
          <div data-page-scroll-container id="own" />
          <Layer />
        </div>
      </>,
    );
    expect(screen.getByLabelText("스크롤 영역").textContent).toBe("own");
  });
  it("가장 가까운 범위 자체가 스크롤 영역이면 그 요소를 사용한다", () => {
    render(
      <div data-modal-scope data-page-scroll-container id="scope">
        <Layer />
      </div>,
    );
    expect(screen.getByLabelText("스크롤 영역").textContent).toBe("scope");
  });
  it("별도 스크롤 영역이 없는 화면도 연결한다", () => {
    render(<Layer />);
    expect(screen.getByLabelText("스크롤 영역").textContent).toBe("없음");
  });
  it("소속 범위가 없으면 문서의 다른 스크롤 영역을 선택하지 않는다", () => {
    render(
      <>
        <div data-modal-scope>
          <div data-page-scroll-container id="other" />
        </div>
        <Layer />
      </>,
    );
    expect(screen.getByLabelText("스크롤 영역").textContent).toBe("없음");
  });
  it("소속 범위 안에 별도 범위만 있으면 그 스크롤 영역을 선택하지 않는다", () => {
    render(
      <div data-modal-scope>
        <div data-modal-scope>
          <div data-page-scroll-container id="nested" />
        </div>
        <Layer />
      </div>,
    );
    expect(screen.getByLabelText("스크롤 영역").textContent).toBe("없음");
  });
  it("중첩 범위를 건너뛰고 소속 범위의 스크롤 영역을 찾는다", () => {
    render(
      <div data-modal-scope>
        <div data-modal-scope>
          <div data-page-scroll-container id="nested" />
        </div>
        <div data-page-scroll-container id="own" />
        <Layer />
      </div>,
    );
    expect(screen.getByLabelText("스크롤 영역").textContent).toBe("own");
  });
});
