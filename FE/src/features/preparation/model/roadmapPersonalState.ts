import type { MyChecklistItemModel } from "../../checklist";

export type ReadyRoadmapPersonalState =
  | { status: "ready"; audience: "guest"; catalogItemIds: readonly string[] }
  | {
      status: "ready";
      audience: "authenticated";
      items: readonly MyChecklistItemModel[];
    };

export type RoadmapPersonalState =
  { status: "unknown" | "loading" | "error" } | ReadyRoadmapPersonalState;
