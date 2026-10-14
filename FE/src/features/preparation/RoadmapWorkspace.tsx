import { ReactNode, useState } from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "../auth";
import { AiChatFeature } from "../ai-chat/AiChatFeature";
import { PersonalRoadmapFeature } from "./PersonalRoadmapFeature";
import { PreparationRoadmapState } from "./view/PreparationRoadmapState";
import { RoadmapView, RoadmapViewSwitcher } from "./view/RoadmapViewSwitcher";
import { RoadmapViewBottomSheet } from "./view/RoadmapViewBottomSheet";
import { useRoadmapViewPicker } from "./hooks/useRoadmapViewPicker";
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
  const [choice, setChoice] = useState<{
    audience: string;
    view: RoadmapView;
  } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryId = searchParams.get("categoryId") ?? initialCategoryId;
  const setCategoryId = (id: string) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("categoryId", id);
        return next;
      },
      { replace: true },
    );
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
  const changeView = (nextView: RoadmapView) =>
    setChoice({ audience, view: nextView });
  const showAll = () => changeView("all");
  const {
    isMobile,
    isOpen: isPickerOpen,
    open: openPicker,
    close: closePicker,
    select: selectPickerView,
    triggerRef,
  } = useRoadmapViewPicker({ audience, onViewChange: changeView });

  if (authState.status === "error") {
    return <PreparationRoadmapState status="error" onRetry={refreshAuth} />;
  }
  if (authState.status !== "authenticated" && authState.status !== "guest") {
    return <PreparationRoadmapState status="loading" />;
  }

  const viewSwitcher = (
    <RoadmapViewSwitcher
      view={view}
      onViewChange={changeView}
      triggerRef={triggerRef}
      mobile={
        isMobile
          ? {
              expanded: isPickerOpen,
              onOpen: openPicker,
            }
          : undefined
      }
    />
  );

  return (
    <div className="roadmap-workspace">
      <div className="roadmap-workspace__roadmap">
        <header className="roadmap-workspace__hero">
          <h1>우리 결혼 준비, 한 단계씩</h1>
          <p>카테고리별 할 일을 확인하고, 나에게 필요한 준비를 모아보세요.</p>
        </header>
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
      <AiChatFeature
        key={audience}
        isAuthenticated={isAuthenticated}
        onAuthenticationRequired={refreshAuth}
      />
      {isPickerOpen ? (
        <RoadmapViewBottomSheet
          view={view}
          onClose={closePicker}
          onViewChange={selectPickerView}
        />
      ) : null}
    </div>
  );
}
