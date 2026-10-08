import { ReactNode, useState } from "react";
import { useAuth } from "../auth";
import { PersonalRoadmapFeature } from "./PersonalRoadmapFeature";
import { PreparationRoadmapState } from "./view/PreparationRoadmapState";
import { RoadmapView, RoadmapViewSwitcher } from "./view/RoadmapViewSwitcher";
import "./view/RoadmapWorkspace.css";

export function RoadmapWorkspace({
  initialCategoryId,
  renderAllSteps,
}: {
  initialCategoryId?: string | null;
  renderAllSteps: (
    categoryId: string | null | undefined,
    onCategorySelect: (id: string) => void,
    viewSwitcher: ReactNode,
  ) => ReactNode;
}) {
  const { authState, refreshAuth } = useAuth();
  const [choice, setChoice] = useState<{
    audience: string;
    view: RoadmapView;
  } | null>(null);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const isAuthenticated = authState.status === "authenticated";
  const audience =
    authState.status === "authenticated"
      ? `authenticated:${authState.user.id}`
      : "guest";
  const view =
    choice?.audience === audience
      ? choice.view
      : isAuthenticated
        ? "personal"
        : "all";
  const showAll = () => setChoice({ audience, view: "all" });

  if (authState.status === "error") {
    return <PreparationRoadmapState status="error" onRetry={refreshAuth} />;
  }
  if (authState.status !== "authenticated" && authState.status !== "guest") {
    return <PreparationRoadmapState status="loading" />;
  }

  const viewSwitcher = (
    <RoadmapViewSwitcher
      view={view}
      onViewChange={(nextView) => setChoice({ audience, view: nextView })}
    />
  );

  return (
    <div className="roadmap-workspace">
      <header className="roadmap-workspace__hero">
        <h1>우리 결혼 준비, 한 단계씩</h1>
        <p>카테고리별 할 일을 확인하고, 나에게 필요한 준비를 모아보세요.</p>
      </header>
      <div id="roadmap-view-content">
        {view === "all" ? (
          renderAllSteps(categoryId, setCategoryId, viewSwitcher)
        ) : isAuthenticated ? (
          <PersonalRoadmapFeature
            key={audience}
            categoryId={categoryId}
            onCategorySelect={setCategoryId}
            onShowAll={showAll}
            viewSwitcher={viewSwitcher}
          />
        ) : (
          <>
            {viewSwitcher}
            <div className="preparation-roadmap-state">
              <p>로그인하면 내 로드맵을 확인할 수 있어요.</p>
              <a href="/login">로그인</a>
              <button type="button" onClick={showAll}>
                전체 단계 보기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
