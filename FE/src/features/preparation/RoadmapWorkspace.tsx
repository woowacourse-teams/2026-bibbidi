import type { ReactNode } from "react";
import { useSearchParams } from "../../app/navigation/navigation";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryId = searchParams.get("categoryId") ?? initialCategoryId;
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
