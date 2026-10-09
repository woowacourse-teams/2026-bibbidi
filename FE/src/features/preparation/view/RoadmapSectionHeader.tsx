import { ReactNode } from "react";

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
  return (
    <header className="roadmap-section-header">
      <div>
        <h2 id={id}>{title}</h2>
        {summary != null ? (
          <p className="roadmap-section-header__summary">{summary}</p>
        ) : null}
      </div>
      {viewSwitcher}
    </header>
  );
}
