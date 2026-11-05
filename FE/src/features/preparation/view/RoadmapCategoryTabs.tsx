import { useLayoutEffect, useRef } from "react";
import { EXPAND_MOTION_STYLE } from "../../../shared/motion";

import "./RoadmapCategoryTabs.css";

export function RoadmapCategoryTabs({
  categories,
  selectedCategoryId,
  controlsId,
  onCategorySelect,
}: {
  categories: readonly { id: string; label: string }[];
  selectedCategoryId?: string;
  controlsId: string;
  onCategorySelect: (id: string) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const categoryLayoutKey = JSON.stringify(
    categories.map(({ id, label }) => [id, label]),
  );

  useLayoutEffect(() => {
    const list = listRef.current;
    const selected = list?.querySelector<HTMLButtonElement>(
      'button[aria-pressed="true"]',
    );

    if (!list) return;
    if (!selected) {
      list.style.setProperty("--category-indicator-width", "0px");
      return;
    }

    const updateIndicator = () => {
      list.style.setProperty(
        "--category-indicator-left",
        `${selected.offsetLeft}px`,
      );
      list.style.setProperty(
        "--category-indicator-width",
        `${selected.offsetWidth}px`,
      );
    };

    updateIndicator();
    const frame = list.dataset.indicatorReady
      ? null
      : window.requestAnimationFrame(() => {
          list.dataset.indicatorReady = "true";
        });
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateIndicator);
    observer?.observe(list);
    observer?.observe(selected);
    if (!observer) window.addEventListener("resize", updateIndicator);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      if (!observer) window.removeEventListener("resize", updateIndicator);
    };
  }, [categoryLayoutKey, selectedCategoryId]);

  return (
    <nav
      aria-label="준비 카테고리"
      className="roadmap-category-tabs"
      style={EXPAND_MOTION_STYLE}
    >
      <ul className="roadmap-category-tabs__list" ref={listRef}>
        {categories.map((category) => (
          <li key={category.id}>
            <button
              aria-controls={controlsId}
              aria-pressed={category.id === selectedCategoryId}
              onClick={() => onCategorySelect(category.id)}
              type="button"
            >
              {category.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
