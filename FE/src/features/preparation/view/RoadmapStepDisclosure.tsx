import { ReactNode, useEffect, useState } from "react";
import { EXPAND_DURATION_MS } from "../../../shared/motion";

export function RoadmapStepDisclosure({
  children,
  expanded,
}: {
  children: ReactNode;
  expanded: boolean;
}) {
  const [content, setContent] = useState(children);

  // Keep the last open detail during collapse, even when another step is selected.
  if (expanded && children !== content) {
    setContent(children);
  }

  const hasContent = content != null;

  useEffect(() => {
    if (expanded || !hasContent) return;

    // Also release the content when transitions are disabled or interrupted.
    const timeout = window.setTimeout(
      () => setContent(null),
      EXPAND_DURATION_MS + 50,
    );
    return () => window.clearTimeout(timeout);
  }, [expanded, hasContent]);

  return (
    <div
      aria-hidden={!expanded}
      className="preparation-roadmap__detail"
      data-expanded={expanded}
      inert={!expanded}
      onTransitionEnd={(event) => {
        if (
          !expanded &&
          event.target === event.currentTarget &&
          event.propertyName === "grid-template-rows"
        ) {
          setContent(null);
        }
      }}
    >
      <div className="preparation-roadmap__detail-inner">{content}</div>
    </div>
  );
}
