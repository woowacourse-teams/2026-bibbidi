import { ReactNode } from "react";
import { RoadmapCategoryTabs } from "./RoadmapCategoryTabs";
import { RoadmapSectionHeader } from "./RoadmapSectionHeader";
import "./PersonalRoadmap.css";

export function PersonalRoadmapLayout({
  categories,
  selectedCategoryId,
  title,
  summary,
  cards,
  onCategorySelect,
  onShowAll,
  viewSwitcher,
}: {
  categories: readonly { id: string; label: string }[];
  selectedCategoryId?: string;
  title: string;
  summary: string;
  cards: readonly { id: string; content: ReactNode }[];
  onCategorySelect: (id: string) => void;
  onShowAll: () => void;
  viewSwitcher: ReactNode;
}) {
  return (
    <div className="personal-roadmap">
      <RoadmapCategoryTabs
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        controlsId="personal-roadmap-content"
        onCategorySelect={onCategorySelect}
      />
      <section
        id="personal-roadmap-content"
        aria-labelledby="personal-roadmap-title"
      >
        <RoadmapSectionHeader
          id="personal-roadmap-title"
          title={title}
          summary={summary}
          viewSwitcher={viewSwitcher}
        />
        {cards.length > 0 ? (
          <ol
            className="personal-roadmap__cards"
            aria-label="내 할 일이 있는 단계"
            // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- 목록을 키보드로 스크롤할 수 있도록 포커스를 허용한다.
            tabIndex={0}
          >
            {cards.map((card) => (
              <li key={card.id}>{card.content}</li>
            ))}
          </ol>
        ) : (
          <div className="preparation-roadmap-state" role="status">
            <p>아직 담은 할 일이 없어요.</p>
            <button type="button" onClick={onShowAll}>
              전체 단계에서 할 일 고르기
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
