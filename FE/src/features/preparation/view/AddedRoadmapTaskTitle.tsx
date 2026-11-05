import { useEffect, useState } from "react";

import { useMediaQuery } from "../../../shared/responsive";

export function AddedRoadmapTaskTitle({
  title,
  isReady,
  onComplete,
}: {
  title: string;
  isReady: boolean;
  onComplete: () => void;
}) {
  const [text, setText] = useState("");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  useEffect(() => {
    if (!isReady) return;
    if (reducedMotion) {
      onComplete();
      return;
    }
    const letters = Array.from(
      new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(title),
      (part) => part.segment,
    );
    let index = 0;
    let timer: number;
    const type = () => {
      index += 1;
      setText(letters.slice(0, index).join(""));
      timer = window.setTimeout(
        index < letters.length ? type : onComplete,
        index < letters.length ? Math.min(45, 900 / letters.length) : 250,
      );
    };
    timer = window.setTimeout(type, 0);
    return () => window.clearTimeout(timer);
  }, [title, isReady, reducedMotion, onComplete]);

  return (
    <span
      aria-hidden="true"
      className="personal-roadmap__task-title personal-roadmap__task-title--added"
    >
      <span className="personal-roadmap__title-reserve">{title}</span>
      <span className="personal-roadmap__title-typing">
        {reducedMotion ? title : text}
      </span>
    </span>
  );
}
