import { ReactNode } from "react";

export function PersonalRoadmapCardFrame({
  id,
  title,
  numberLabel,
  summary,
  isCurrent = false,
  children,
}: {
  id: string;
  title: string;
  numberLabel: string;
  summary: string;
  isCurrent?: boolean;
  children: ReactNode;
}) {
  return (
    <article
      className={`personal-roadmap__card${isCurrent ? " personal-roadmap__card--current" : ""}`}
      aria-labelledby={`personal-roadmap-group-${id}`}
    >
      <header className="personal-roadmap__card-header">
        <span className="personal-roadmap__number">{numberLabel}</span>
        <h3 id={`personal-roadmap-group-${id}`}>{title}</h3>
        <p>{summary}</p>
      </header>
      <ul
        className="personal-roadmap__tasks"
        aria-label={`${title}의 할 일`}
        // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- 카드 안의 긴 할 일 목록을 키보드로 스크롤한다.
        tabIndex={0}
      >
        {children}
      </ul>
    </article>
  );
}
