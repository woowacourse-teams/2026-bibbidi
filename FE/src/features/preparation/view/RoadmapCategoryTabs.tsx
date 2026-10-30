import { Tab } from "../../../components/tab";

export function RoadmapCategoryTabs({
  categories,
  selectedCategoryId,
  controlsId,
  onCategorySelect,
}: {
  categories: readonly { id: string; label: string }[];
  selectedCategoryId: string;
  controlsId: string;
  onCategorySelect: (id: string) => void;
}) {
  return (
    <Tab
      fluid
      aria-label="준비 카테고리"
      onChange={(index) => onCategorySelect(categories[index].id)}
    >
      {categories.map((category) => (
        <Tab.Item
          key={category.id}
          id={`roadmap-category-${category.id}`}
          selected={category.id === selectedCategoryId}
          aria-controls={controlsId}
        >
          {category.label}
        </Tab.Item>
      ))}
    </Tab>
  );
}
