import { useId } from "react";
import { Checkbox } from "../../../components/checkbox";
import { ListFooter } from "../../../components/list-footer";
import type { BalanceGameRecommendation } from "../model/balanceGame";

const CATEGORY_PREVIEW_COUNT = 3;

export function BalanceGameRecommendationGroup({
  category,
  items,
  addedIds,
  selectedIds,
  saving,
  expanded,
  onSelect,
  onToggle,
}: {
  category: string;
  items: BalanceGameRecommendation[];
  addedIds: string[];
  selectedIds: string[];
  saving: boolean;
  expanded: boolean;
  onSelect: (checked: boolean, id: string) => void;
  onToggle: () => void;
}) {
  const id = useId();
  const headingId = `${id}-heading`;
  const listId = `${id}-list`;
  const visibleItems = expanded
    ? items
    : items.slice(0, CATEGORY_PREVIEW_COUNT);
  const remaining = items.length - CATEGORY_PREVIEW_COUNT;
  const footerLabel = expanded ? "접기" : `더보기 (${remaining}개)`;

  return (
    <section
      className="balance-game__recommendation-group"
      aria-labelledby={headingId}
    >
      <div className="balance-game__group-header">
        <h3 id={headingId}>{category}</h3>
        <span>{items.length}개</span>
      </div>
      <ul id={listId}>
        {visibleItems.map((item) => {
          const itemId = String(item.catalogItemId);
          const added = addedIds.includes(itemId);
          return (
            <li key={itemId}>
              <label>
                <Checkbox
                  checked={added || selectedIds.includes(itemId)}
                  disabled={saving || added}
                  onCheckedChange={(checked) => onSelect(checked, itemId)}
                />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.stepName}</small>
                </span>
                {added && (
                  <span className="balance-game__added">이미 담음</span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
      {remaining > 0 && (
        <ListFooter
          border="indented"
          horizontalPadding="small"
          aria-label={`${category} ${footerLabel}`}
          aria-controls={listId}
          aria-expanded={expanded}
          onClick={onToggle}
        >
          {footerLabel}
        </ListFooter>
      )}
    </section>
  );
}
