import { useState } from "react";
import type { ViewportMetrics } from "../../../shared/viewport";

/** Keyboard policy only. The layout owns how it responds to this state. */
export function useAiChatKeyboard(viewport: ViewportMetrics, editing: boolean) {
  const height = Math.max(
    viewport.layoutHeight,
    viewport.height + viewport.offsetTop,
  );
  const [session, setSession] = useState({
    editing,
    width: viewport.layoutWidth,
    height,
  });
  const changed =
    session.editing !== editing || session.width !== viewport.layoutWidth;
  if (changed || (!editing && session.height !== height)) {
    setSession({ editing, width: viewport.layoutWidth, height });
  }
  const baseline = changed ? height : session.height;
  return (
    editing &&
    viewport.scale === 1 &&
    baseline - viewport.height - viewport.offsetTop > 120
  );
}
