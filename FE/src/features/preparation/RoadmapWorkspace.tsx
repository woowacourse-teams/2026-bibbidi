import { ReactNode, useState } from "react";
import { useAuth } from "../auth";
import { AiChatFeature } from "../ai-chat/AiChatFeature";
import { useExampleTaskAddition } from "../ai-chat/hooks/useExampleTaskAddition";
import { ExampleAddedTaskList } from "../ai-chat/view/ExampleAddedTaskList";
import { useIsMobileLayout } from "../../shared/responsive";
import { PersonalRoadmapFeature } from "./PersonalRoadmapFeature";
import { PreparationRoadmapState } from "./view/PreparationRoadmapState";
import { RoadmapView, RoadmapViewSwitcher } from "./view/RoadmapViewSwitcher";
import "./view/RoadmapWorkspace.css";

export function RoadmapWorkspace({
  initialCategoryId,
  renderCatalogRoadmap,
}: {
  initialCategoryId?: string | null;
  renderCatalogRoadmap: (options: {
    categoryId: string | null | undefined;
    onCategorySelect: (id: string) => void;
    viewSwitcher: ReactNode;
    view: RoadmapView;
    onShowAll: () => void;
  }) => ReactNode;
}) {
  const { authState, refreshAuth } = useAuth();
  const isMobile = useIsMobileLayout();
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
  const addition = useExampleTaskAddition({
    audience:
      authState.status === "authenticated" || authState.status === "guest"
        ? audience
        : null,
    isMobile,
  });

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
      <div className="roadmap-workspace__roadmap">
        <header className="roadmap-workspace__hero">
          <h1>우리 결혼 준비, 한 단계씩</h1>
          <p>카테고리별 할 일을 확인하고, 나에게 필요한 준비를 모아보세요.</p>
        </header>
        <ExampleAddedTaskList
          key={audience}
          tasks={addition.tasks}
          visibleCount={addition.visibleCount}
          focusRequest={addition.focusRequest}
          isPaused={addition.isPaused}
          completedCount={addition.completedCount}
          onTaskComplete={addition.completeTask}
        />
        <div id="roadmap-view-content">
          {view === "all" || !isAuthenticated ? (
            renderCatalogRoadmap({
              categoryId,
              onCategorySelect: setCategoryId,
              viewSwitcher,
              view,
              onShowAll: showAll,
            })
          ) : (
            <PersonalRoadmapFeature
              key={audience}
              categoryId={categoryId}
              onCategorySelect={setCategoryId}
              onShowAll={showAll}
              viewSwitcher={viewSwitcher}
            />
          )}
        </div>
      </div>
      <AiChatFeature key={audience} addition={addition} />
    </div>
  );
}
