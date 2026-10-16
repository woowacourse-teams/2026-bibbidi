import { PreparationRoadmapFeature } from "../features/preparation";
import { useSearchParams } from "react-router";
import "./PreparationCatalogPage.css";

export function PreparationCatalogPage() {
  const [searchParams] = useSearchParams();

  return (
    <div className="preparation-catalog-page">
      <main aria-label="준비 목록">
        <PreparationRoadmapFeature
          initialCategoryId={searchParams.get("categoryId")}
        />
      </main>
    </div>
  );
}
