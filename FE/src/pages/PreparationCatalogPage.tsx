import { PreparationRoadmapFeature } from "../features/preparation";
import { PageContainer } from "../components/page-container";
import { useSearchParams } from "react-router";
import "./PreparationCatalogPage.css";

export function PreparationCatalogPage() {
  const [searchParams] = useSearchParams();

  return (
    <div className="preparation-catalog-page">
      <main aria-label="준비 목록">
        <PageContainer width="wide">
          <PreparationRoadmapFeature
            initialCategoryId={searchParams.get("categoryId")}
          />
        </PageContainer>
      </main>
    </div>
  );
}
