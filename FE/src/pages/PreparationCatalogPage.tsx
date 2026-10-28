import { PreparationRoadmapFeature } from "../features/preparation";
import { PageContainer } from "../components/page-container";
import { Link, useSearchParams } from "react-router";
import "./PreparationCatalogPage.css";

export function PreparationCatalogPage() {
  const [searchParams] = useSearchParams();

  return (
    <div className="preparation-catalog-page">
      <main aria-label="준비 목록">
        <PageContainer width="wide">
          <Link
            className="preparation-catalog-page__balance-link"
            to="/balance-game"
          >
            <span>
              <strong>우리 결혼, 어떤 모습이면 좋을까?</strong>
              <span>10가지 선택으로 우리에게 맞는 할 일을 추천받아요.</span>
            </span>
            <span>
              밸런스게임 시작하기 <span aria-hidden="true">→</span>
            </span>
          </Link>
          <PreparationRoadmapFeature
            initialCategoryId={searchParams.get("categoryId")}
          />
        </PageContainer>
      </main>
    </div>
  );
}
