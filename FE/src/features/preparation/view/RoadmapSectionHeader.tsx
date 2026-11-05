import { ReactNode } from "react";
import { useIsMobileLayout } from "../../../shared/responsive";

export function RoadmapSectionHeader({
  id,
  title,
  summary,
  viewSwitcher,
}: {
  id: string;
  title: string;
  summary?: ReactNode;
  viewSwitcher: ReactNode;
}) {
  const isMobile = useIsMobileLayout();
  return (
    <header className="roadmap-section-header">
      <div>
        <h2 id={id}>{isMobile && viewSwitcher ? viewSwitcher : title}</h2>
        {summary != null ? (
          <p className="roadmap-section-header__summary">{summary}</p>
        ) : null}
      </div>
      {!isMobile ? viewSwitcher : null}
    </header>
  );
}
