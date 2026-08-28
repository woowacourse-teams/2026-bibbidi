import { PreparationRoadmapFeature } from "../features/preparation";
import { BrandHeader } from "../layouts/BrandHeader";
import "./PreparationCatalogPage.css";

export function PreparationCatalogPage() {
  return (
    <div className="preparation-catalog-page">
      <BrandHeader />
      <main aria-label="준비 목록">
        <PreparationRoadmapFeature />
      </main>
    </div>
  );
}
