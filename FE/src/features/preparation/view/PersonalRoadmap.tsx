import { ReactNode } from "react";
import { PersonalRoadmapCategoryViewModel } from "../view-model/createPersonalRoadmapViewModel";
import { RoadmapSectionHeader } from "./RoadmapSectionHeader";
import { PersonalRoadmapCard } from "./PersonalRoadmapCard";
import "./PersonalRoadmap.css";

export function PersonalRoadmap({
  categories,
  categoryId,
  onCategorySelect,
  onShowAll,
  viewSwitcher,
}: {
  categories: PersonalRoadmapCategoryViewModel[];
  categoryId?: string | null;
  onCategorySelect: (id: string) => void;
  onShowAll: () => void;
  viewSwitcher: ReactNode;
}) {
  const category =
    categories.find((item) => item.id === categoryId) ?? categories[0];

  return (
    <div className="personal-roadmap">
      <nav aria-label="준비 카테고리" className="personal-roadmap__categories">
        {categories.map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={item.id === category?.id}
            aria-controls="personal-roadmap-content"
            onClick={() => onCategorySelect(item.id)}
          >
            {item.title}
          </button>
        ))}
      </nav>
      <section
        id="personal-roadmap-content"
        aria-labelledby="personal-roadmap-title"
      >
        <RoadmapSectionHeader
          id="personal-roadmap-title"
          title={`${category?.title ?? "준비"} 로드맵`}
          summary={`${category?.stepCount ?? 0}개 단계 · 내 할 일 ${category?.totalCount ?? 0}개 · 완료 ${category?.completedCount ?? 0}개`}
          viewSwitcher={viewSwitcher}
        />
        {category && category.groups.length > 0 ? (
          <ol
            className="personal-roadmap__cards"
            aria-label="내 할 일이 있는 단계"
            // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- 목록을 키보드로 스크롤할 수 있도록 포커스를 허용한다.
            tabIndex={0}
          >
            {category.groups.map((group) => (
              <li key={group.id}>
                <PersonalRoadmapCard group={group} />
              </li>
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
