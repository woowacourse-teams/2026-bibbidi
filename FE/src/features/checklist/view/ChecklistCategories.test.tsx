import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ChecklistCategories } from "./ChecklistCategories";

const categories = [
  { id: "venue", title: "예식장", countLabel: "1/3" },
  { id: "studio", title: "스튜디오", countLabel: "0/2" },
  { id: "travel", title: "신혼여행", countLabel: "0/1" },
];

function Harness({ placement }: { placement: "top" | "side" }) {
  const [selected, setSelected] = useState("venue");
  return (
    <ChecklistCategories
      categories={categories}
      selectedCategoryId={selected}
      controlsId="category-content"
      placement={placement}
      onSelect={setSelected}
    />
  );
}

it("상단 탭을 방향키·Home·End로 선택하고 하나의 탭만 탭 순서에 둔다", () => {
  render(<Harness placement="top" />);
  const [venue, studio, travel] = screen.getAllByRole("tab");
  expect(screen.getByRole("tablist").classList.contains("bibbidi-tab")).toBe(
    true,
  );
  expect(venue.getAttribute("aria-controls")).toBe("category-content");
  expect(venue.getAttribute("aria-label")).toBe("예식장 1/3");
  venue.focus();
  fireEvent.keyDown(venue, { key: "ArrowRight" });
  expect(document.activeElement).toBe(studio);
  expect(studio.getAttribute("aria-selected")).toBe("true");
  expect(venue.tabIndex).toBe(-1);
  expect(studio.tabIndex).toBe(0);
  fireEvent.keyDown(studio, { key: "End" });
  expect(document.activeElement).toBe(travel);
  fireEvent.keyDown(travel, { key: "ArrowRight" });
  expect(document.activeElement).toBe(venue);
  fireEvent.keyDown(venue, { key: "ArrowLeft" });
  expect(document.activeElement).toBe(travel);
  fireEvent.keyDown(travel, { key: "Home" });
  expect(document.activeElement).toBe(venue);
  expect(venue.getAttribute("aria-selected")).toBe("true");
});

it("상단과 측면을 왕복해도 같은 카테고리를 선택하고 라벨 전체로 선택한다", () => {
  const { rerender } = render(<Harness placement="top" />);
  fireEvent.click(screen.getByRole("tab", { name: "스튜디오 0/2" }));
  rerender(<Harness placement="side" />);
  expect(screen.queryByRole("tablist")).toBeNull();
  const studio = screen.getByRole("radio", {
    name: "스튜디오 0/2",
  }) as HTMLInputElement;
  expect(
    studio.closest(".bibbidi-checkbox")?.getAttribute("data-variant"),
  ).toBe("circle");
  expect(studio.checked).toBe(true);
  expect(screen.getByRole("group", { name: "카테고리" })).toBeTruthy();
  expect(screen.queryByText("0/2")).toBeNull();
  fireEvent.click(screen.getByText("신혼여행"));
  const radios = screen.getAllByRole("radio") as HTMLInputElement[];
  expect(radios.map((radio) => radio.checked)).toEqual([false, false, true]);
  expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);
  rerender(<Harness placement="top" />);
  expect(
    screen
      .getByRole("tab", { name: "신혼여행 0/1" })
      .getAttribute("aria-selected"),
  ).toBe("true");
});

it("선택된 탭을 다시 눌러도 카테고리 전환을 요청하지 않는다", () => {
  const onSelect = vi.fn();
  render(
    <ChecklistCategories
      categories={categories}
      selectedCategoryId="venue"
      placement="top"
      controlsId="category-content"
      onSelect={onSelect}
    />,
  );
  fireEvent.click(screen.getByRole("tab", { name: "예식장 1/3" }));
  expect(onSelect).not.toHaveBeenCalled();
});
