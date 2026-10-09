import { ReactNode } from "react";

import { PreparationCategoryViewModel } from "../view-model/createPreparationRoadmapViewModel";
import { RoadmapCategoryTabs } from "./RoadmapCategoryTabs";
import { RoadmapLoginNotice } from "./RoadmapLoginNotice";
import { RoadmapSectionHeader } from "./RoadmapSectionHeader";
import "./PersonalRoadmap.css";

export function GuestPersonalRoadmap({
  categories,
  onCategorySelect,
  onShowAll,
  viewSwitcher,
}: {
  categories: readonly PreparationCategoryViewModel[];
  onCategorySelect: (id: string) => void;
  onShowAll: () => void;
  viewSwitcher: ReactNode;
}) {
  const category = categories.find((item) => item.isCurrent);

  return (
    <div className="personal-roadmap">
      <RoadmapCategoryTabs
        categories={categories}
        selectedCategoryId={category?.id}
        controlsId="personal-roadmap-content"
        onCategorySelect={onCategorySelect}
      />
      <section
        aria-labelledby="personal-roadmap-title"
        id="personal-roadmap-content"
      >
        <RoadmapSectionHeader
          id="personal-roadmap-title"
          title={`${category?.label ?? "준비"} 로드맵`}
          viewSwitcher={viewSwitcher}
        />
        <RoadmapLoginNotice onShowAll={onShowAll} />
      </section>
    </div>
  );
}
