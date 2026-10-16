import { useEffect, useRef, useState } from "react";

export function useRoadmapTaskScroll(taskId?: string) {
  const ref = useRef<HTMLLIElement>(null);
  const [scroll, setScroll] = useState({ taskId, isReady: false });
  if (scroll.taskId !== taskId) setScroll({ taskId, isReady: false });

  useEffect(() => {
    const target = ref.current;
    if (!target || taskId === undefined) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    target.scrollIntoView({
      behavior: reducedMotion ? "instant" : "smooth",
      block: "nearest",
      inline: "center",
    });
    let previous = target.getBoundingClientRect();
    let stableFrames = 0;
    let frame: number;
    const checkPosition = () => {
      const current = target.getBoundingClientRect();
      stableFrames =
        current.top === previous.top && current.left === previous.left
          ? stableFrames + 1
          : 0;
      previous = current;
      if (reducedMotion || stableFrames >= 3)
        setScroll({ taskId, isReady: true });
      else frame = window.requestAnimationFrame(checkPosition);
    };
    frame = window.requestAnimationFrame(checkPosition);
    return () => window.cancelAnimationFrame(frame);
  }, [taskId]);

  return {
    ref,
    isReady: taskId !== undefined && scroll.taskId === taskId && scroll.isReady,
  };
}
