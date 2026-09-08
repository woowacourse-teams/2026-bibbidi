import { PreparationStepTaskViewModel } from "../view-model/createPreparationRoadmapViewModel";
import { PreparationTaskList } from "./PreparationTaskList";
import "./PreparationStepChecklist.css";

interface PreparationStepChecklistProps {
  tasks: PreparationStepTaskViewModel[];
}

export function PreparationStepChecklist({
  tasks,
}: PreparationStepChecklistProps) {
  return (
    <section
      aria-label="이 단계의 체크리스트"
      aria-live="polite"
      className={`preparation-step-checklist${tasks.length === 0 ? " preparation-step-checklist--empty" : ""}`}
    >
      <header className="preparation-step-checklist__header">
        <h2>이 단계의 체크리스트</h2>
        <span className="preparation-step-checklist__count">
          {tasks.length}개
        </span>
      </header>
      <PreparationTaskList isScrollable tasks={tasks} variant="checklist" />
    </section>
  );
}
