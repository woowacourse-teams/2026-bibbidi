import { useEffect, useMemo, useState } from "react";

import { catalogRepository, type CatalogModel } from "../../catalog";
import type { RecommendedTask } from "../model/recommendation";

type CatalogState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; catalog: CatalogModel };

export function useAiChatRecommendationCatalog(enabled: boolean) {
  const [state, setState] = useState<CatalogState>({ status: "loading" });

  useEffect(() => {
    if (!enabled || state.status !== "loading") return;
    const controller = new AbortController();
    catalogRepository.getCatalog(controller.signal).then(
      (catalog) => {
        if (!controller.signal.aborted) setState({ status: "ready", catalog });
      },
      () => {
        if (!controller.signal.aborted) setState({ status: "error" });
      },
    );
    return () => controller.abort();
  }, [enabled, state.status]);

  const tasksById = useMemo(() => {
    const catalog = state.status === "ready" ? state.catalog : undefined;
    const steps = new Map(
      catalog?.roadmaps.flatMap((roadmap) =>
        roadmap.steps.map((step) => [step.id, step.title] as const),
      ),
    );
    return new Map<string, RecommendedTask>(
      catalog?.stepDetails.flatMap((detail) =>
        detail.tasks.map(
          (task) =>
            [
              task.id,
              {
                id: task.id,
                title: task.title,
                stepTitle: steps.get(detail.stepId) ?? "",
              },
            ] as const,
        ),
      ),
    );
  }, [state]);

  return {
    status: state.status,
    tasksById,
    retry: () => setState({ status: "loading" }),
  };
}
