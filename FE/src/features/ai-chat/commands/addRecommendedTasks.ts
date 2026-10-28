import type { MyChecklistQueryRepository } from "../../checklist";
import type { ChecklistRepository } from "../../preparation";
import { PreparationDuplicateChecklistItemError } from "../../preparation/repository/preparationErrors";

/** Save the selection and reconcile one concurrent addition without duplicating it. */
export async function addRecommendedTasks({
  ids,
  checklist,
  query,
  signal,
}: {
  ids: string[];
  checklist: ChecklistRepository;
  query: MyChecklistQueryRepository;
  signal: AbortSignal;
}): Promise<{ addedIds: string[]; confirmedIds: string[] }> {
  let known = new Set(
    await checklist.getCatalogItemIds("authenticated", signal),
  );
  let addedIds: string[] = [];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    signal.throwIfAborted();
    const missing = ids.filter((id) => !known.has(id));
    if (!missing.length) break;
    try {
      addedIds = await checklist.addCatalogItemIds(
        "authenticated",
        missing,
        signal,
      );
      for (const id of addedIds) known.add(id);
      break;
    } catch (error) {
      if (
        !(error instanceof PreparationDuplicateChecklistItemError) ||
        attempt > 0
      )
        throw error;
      const refreshed = await query.refresh(signal);
      known = new Set(
        refreshed.items.flatMap((item) =>
          item.sourceCatalogItemId === null
            ? []
            : [String(item.sourceCatalogItemId)],
        ),
      );
    }
  }

  signal.throwIfAborted();
  return { addedIds, confirmedIds: ids.filter((id) => known.has(id)) };
}
