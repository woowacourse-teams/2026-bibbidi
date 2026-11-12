"use client";

import type { CatalogModel } from "../features/catalog";
import { PreparationRoadmapFeature } from "../features/preparation";
import { PageContainer } from "../components/page-container";
import "./PreparationCatalogPage.css";

export function PreparationCatalogPage({
  catalog,
}: { catalog?: CatalogModel } = {}) {
  return (
    <div className="preparation-catalog-page">
      <main aria-label="준비 목록">
        <PageContainer width="wide">
          <PreparationRoadmapFeature initialCatalog={catalog} />
        </PageContainer>
      </main>
    </div>
  );
}
