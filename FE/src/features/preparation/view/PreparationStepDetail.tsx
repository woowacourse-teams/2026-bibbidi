import { PreparationStepDetailViewModel } from "../view-model/createPreparationRoadmapViewModel";
import {
  PreparationAddAllTasksButton,
  PreparationTaskList,
} from "./PreparationTaskList";

type PreparationStepDetailContentViewModel = Pick<
  PreparationStepDetailViewModel,
  "description" | "detailTasks" | "title"
>;

interface PreparationStepDetailProps {
  detail: PreparationStepDetailContentViewModel;
}

export function PreparationStepDetail({ detail }: PreparationStepDetailProps) {
  return (
    <aside
      aria-live="polite"
      aria-label="이 단계에서 준비할 일"
      className="preparation-step-detail"
      id="preparation-step-detail"
    >
      <div className="preparation-step-detail__panel">
        <header className="preparation-step-detail__header">
          <h2>{detail.title}</h2>
          <p>{detail.description}</p>
        </header>

        <div className="preparation-step-detail__content">
          <section
            aria-label="세부 할 일"
            className="preparation-step-detail__section"
          >
            <PreparationTaskList
              tasks={detail.detailTasks}
              variant="available"
            />
          </section>
        </div>
        <footer className="preparation-step-detail__footer">
          <PreparationAddAllTasksButton />
        </footer>
      </div>
    </aside>
  );
}
