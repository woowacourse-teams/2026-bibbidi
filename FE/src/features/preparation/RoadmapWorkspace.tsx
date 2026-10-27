import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "../auth";
import { PreparationRoadmapState } from "./view/PreparationRoadmapState";
import "./view/RoadmapWorkspace.css";

export function RoadmapWorkspace({
  initialCategoryId,
  renderCatalogRoadmap,
}: {
  initialCategoryId?: string | null;
  renderCatalogRoadmap: (options: {
    categoryId: string | null | undefined;
    onCategorySelect: (id: string) => void;
  }) => ReactNode;
}) {
  const { authState, refreshAuth } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryId = searchParams.get("categoryId") ?? initialCategoryId;
  if (authState.status === "error")
    return <PreparationRoadmapState status="error" onRetry={refreshAuth} />;
  if (authState.status !== "authenticated" && authState.status !== "guest")
    return <PreparationRoadmapState status="loading" />;
  return (
    <div className="roadmap-workspace">
      <div className="roadmap-workspace__roadmap">
        {renderCatalogRoadmap({
          categoryId,
          onCategorySelect: (id) =>
            setSearchParams(
              (current) => {
                const next = new URLSearchParams(current);
                next.set("categoryId", id);
                return next;
              },
              { replace: true },
            ),
        })}
      </div>
    </div>
  );
}
