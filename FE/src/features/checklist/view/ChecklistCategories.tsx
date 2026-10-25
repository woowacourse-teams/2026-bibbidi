import type { ChecklistCategoryViewModel } from "../view-model/createChecklistViewModel";
import "./ChecklistCategories.css";

interface ChecklistCategoriesProps {
  categories: Pick<ChecklistCategoryViewModel, "id" | "title" | "countLabel">[];
  selectedCategoryId?: string;
  controlsId: string;
  placement: "side" | "top";
  onSelect: (categoryId: string) => void;
}

export function ChecklistCategories({
  categories,
  selectedCategoryId,
  controlsId,
  placement,
  onSelect,
}: ChecklistCategoriesProps) {
  return (
    <nav
      aria-label="체크리스트 대분류"
      className="checklist-categories"
      data-placement={placement}
    >
      <ul className="checklist-categories__list">
        {categories.map((category) => (
          <li key={category.id}>
            <button
              aria-controls={controlsId}
              aria-label={`${category.title} ${category.countLabel}`}
              aria-pressed={category.id === selectedCategoryId}
              className="checklist-categories__button"
              onClick={() => onSelect(category.id)}
              type="button"
            >
              <span className="checklist-categories__label">
                {category.title}
              </span>
              <span className="checklist-categories__count">
                {category.countLabel}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
