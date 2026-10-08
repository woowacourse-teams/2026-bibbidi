export type RoadmapView = "personal" | "all";

function RoadmapViewIcon({
  view,
  isSelected,
}: {
  view: RoadmapView;
  isSelected: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={isSelected ? "roadmap-workspace__views-check" : undefined}
      viewBox="0 0 16 16"
    >
      <path
        d={
          isSelected
            ? "m2 8 4 4 8-8"
            : view === "personal"
              ? "M1.5 1.5h5v5h-5zM9.5 1.5h5v5h-5zM1.5 9.5h5v5h-5zM9.5 9.5h5v5h-5z"
              : "M1.5 3h2M6 3h8.5M1.5 8h2M6 8h8.5M1.5 13h2M6 13h8.5"
        }
      />
    </svg>
  );
}

export function RoadmapViewSwitcher({
  view,
  onViewChange,
}: {
  view: RoadmapView;
  onViewChange: (view: RoadmapView) => void;
}) {
  return (
    <nav aria-label="로드맵 보기" className="roadmap-workspace__views">
      <button
        type="button"
        aria-pressed={view === "personal"}
        aria-controls="roadmap-view-content"
        onClick={() => onViewChange("personal")}
      >
        <RoadmapViewIcon view="personal" isSelected={view === "personal"} />
        <span>내 로드맵</span>
      </button>
      <button
        type="button"
        aria-pressed={view === "all"}
        aria-controls="roadmap-view-content"
        onClick={() => onViewChange("all")}
      >
        <RoadmapViewIcon view="all" isSelected={view === "all"} />
        <span>전체 단계</span>
      </button>
    </nav>
  );
}
