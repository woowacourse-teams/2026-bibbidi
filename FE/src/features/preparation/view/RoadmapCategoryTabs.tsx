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
  return (
    <nav aria-label="준비 카테고리" className="roadmap-category-tabs">
      <ul className="roadmap-category-tabs__list">
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
