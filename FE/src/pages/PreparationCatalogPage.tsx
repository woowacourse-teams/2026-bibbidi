import { PreparationRoadmapFeature } from "../features/preparation";
import "./PreparationCatalogPage.css";

export function PreparationCatalogPage() {
  return (
    <div className="preparation-catalog-page">
      <main aria-label="준비 목록">
        <PreparationRoadmapFeature />
      </main>
    </div>
  );
}
