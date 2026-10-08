import { ReactNode } from "react";
import { useRoadmapChecklist } from "./hooks/useRoadmapChecklist";
import { createPersonalRoadmapViewModel } from "./view-model/createPersonalRoadmapViewModel";
import { PersonalRoadmap } from "./view/PersonalRoadmap";
import { PreparationRoadmapState } from "./view/PreparationRoadmapState";

export function PersonalRoadmapFeature(props: {
  categoryId?: string | null;
  onCategorySelect: (id: string) => void;
  onShowAll: () => void;
  viewSwitcher: ReactNode;
}) {
  const { request, retry } = useRoadmapChecklist();
  if (request.status !== "success") {
    return (
      <>
        {props.viewSwitcher}
        <PreparationRoadmapState status={request.status} onRetry={retry} />
      </>
    );
  }
  return (
    <PersonalRoadmap
      {...props}
      categories={createPersonalRoadmapViewModel(request.checklist)}
    />
  );
}
