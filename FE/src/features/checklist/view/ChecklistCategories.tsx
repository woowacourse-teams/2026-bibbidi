import { useId } from "react";
import { Checkbox } from "../../../components/checkbox";
import { Tab } from "../../../components/tab";
import type { ChecklistCategoryViewModel } from "../view-model/createChecklistViewModel";
import "./ChecklistCategories.css";

interface ChecklistCategoriesProps {
  categories: Pick<ChecklistCategoryViewModel, "id" | "title" | "countLabel">[];
  selectedCategoryId?: string;
  controlsId: string;
  placement: "side" | "top";
  onSelect: (categoryId: string) => void;
}

export function getChecklistCategoryTabId(categoryId: string) {
  return `checklist-category-tab-${categoryId}`;
}

export function ChecklistCategories({
  categories,
  selectedCategoryId,
  controlsId,
  placement,
  onSelect,
}: ChecklistCategoriesProps) {
  const radioName = useId();
  return (
    <nav aria-label="체크리스트 대분류" className="checklist-categories">
      {placement === "top" ? (
        <Tab
          ariaLabel="체크리스트 대분류"
          size="small"
          fluid
          onChange={(index) => onSelect(categories[index].id)}
        >
          {categories.map((category) => (
            <Tab.Item
              key={category.id}
              id={getChecklistCategoryTabId(category.id)}
              aria-controls={controlsId}
              aria-label={`${category.title} ${category.countLabel}`}
              selected={category.id === selectedCategoryId}
            >
              {category.title}
            </Tab.Item>
          ))}
        </Tab>
      ) : (
        <fieldset className="checklist-categories__group">
          <legend>카테고리</legend>
          {categories.map((category) => (
            <label className="checklist-categories__option" key={category.id}>
              <Checkbox.Circle
                inputType="radio"
                size={20}
                name={radioName}
                value={category.id}
                aria-controls={controlsId}
                aria-label={`${category.title} ${category.countLabel}`}
                checked={category.id === selectedCategoryId}
                onChange={(event) => onSelect(event.currentTarget.value)}
              />
              <span>{category.title}</span>
            </label>
          ))}
        </fieldset>
      )}
    </nav>
  );
}
