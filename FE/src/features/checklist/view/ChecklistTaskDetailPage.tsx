import { ReactNode, useEffect, useRef } from "react";

import { ChecklistTaskViewModel } from "../view-model/createChecklistViewModel";
import { ChecklistTaskDetailContent } from "./ChecklistTaskDetailContent";
import "./ChecklistTaskDetailPage.css";

interface ChecklistTaskDetailPageProps {
  categoryTitle: string;
  onBack: () => void;
  task: ChecklistTaskViewModel;
}

interface ChecklistTaskDetailPageShellProps {
  children: ReactNode;
  onBack: () => void;
  title: string;
  titleId?: string;
}

function BackIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function ChecklistTaskDetailPageShell({
  children,
  onBack,
  title,
  titleId = "checklist-task-detail-page-title",
}: ChecklistTaskDetailPageShellProps) {
  const backButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    backButtonRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby={titleId}
      className="checklist-detail-page"
      id="checklist-task-detail-page"
    >
      <header className="checklist-detail-page__header">
        <button
          aria-label="체크리스트로 돌아가기"
          className="checklist-detail-page__back"
          onClick={onBack}
          ref={backButtonRef}
          type="button"
        >
          <BackIcon />
        </button>
        <h2 id={titleId}>{title}</h2>
        <span aria-hidden="true" className="checklist-detail-page__spacer" />
      </header>

      <div className="checklist-detail-page__content">{children}</div>
    </section>
  );
}

export function ChecklistTaskDetailPage({
  categoryTitle,
  onBack,
  task,
}: ChecklistTaskDetailPageProps) {
  return (
    <ChecklistTaskDetailPageShell
      onBack={onBack}
      title={task.title}
      titleId={`${task.id}-detail-title`}
    >
      <ChecklistTaskDetailContent categoryTitle={categoryTitle} task={task} />
    </ChecklistTaskDetailPageShell>
  );
}
