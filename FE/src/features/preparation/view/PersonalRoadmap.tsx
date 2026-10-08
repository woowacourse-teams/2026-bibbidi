import { ReactNode, useState } from "react";
import { PersonalRoadmapCategoryViewModel } from "../view-model/createPersonalRoadmapViewModel";
import { RoadmapSectionHeader } from "./RoadmapSectionHeader";
import { PreparationStepChecklist } from "./PreparationStepChecklist";

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
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const category =
    categories.find((item) => item.id === categoryId) ?? categories[0];
  const group =
    category?.groups.find((item) => item.id === selectedGroupId) ??
    category?.groups[0];

  return (
    <div className="personal-roadmap">
      <nav aria-label="준비 카테고리" className="personal-roadmap__categories">
        {categories.map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={item.id === category?.id}
            aria-controls="personal-roadmap-content"
            onClick={() => {
              setSelectedGroupId(null);
              onCategorySelect(item.id);
            }}
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
        {group ? (
          <>
            <ol
              className="personal-roadmap__cards"
              aria-label="내 할 일이 있는 단계"
            >
              {category.groups.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={item.id === group.id}
                    aria-controls="personal-roadmap-detail"
                    onClick={() => setSelectedGroupId(item.id)}
                  >
                    <span className="personal-roadmap__number">
                      {item.numberLabel}
                    </span>
                    <span>{item.title}</span>
                  </button>
                </li>
              ))}
            </ol>
            <section
              id="personal-roadmap-detail"
              className="personal-roadmap__detail"
              aria-labelledby="personal-roadmap-detail-title"
              aria-live="polite"
            >
              <h2 id="personal-roadmap-detail-title">{group.title}</h2>
              <PreparationStepChecklist
                tasks={group.tasks.map((task) => ({
                  id: task.id,
                  title: task.title,
                  isEssential: false,
                }))}
              />
            </section>
          </>
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
