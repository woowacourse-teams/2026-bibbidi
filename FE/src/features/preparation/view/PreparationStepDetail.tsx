import { PreparationStepDetailViewModel } from "../view-model/createPreparationRoadmapViewModel";
import {
  PreparationAddAllTasksButton,
  PreparationTaskList,
} from "./PreparationTaskList";
import { PreparationStepChecklist } from "./PreparationStepChecklist";

type PreparationStepDetailContentViewModel = Pick<
  PreparationStepDetailViewModel,
  "checklistTasks" | "description" | "detailTasks" | "numberLabel" | "title"
>;

interface PreparationStepDetailProps {
  additionErrorMessage: string | null;
  addingCatalogItemIds: readonly string[];
  canAddTasks: boolean;
  detail: PreparationStepDetailContentViewModel;
  onAddAllTasks: () => void;
  onTaskAdd: (catalogItemId: string) => void;
}

export function PreparationStepDetail({
  additionErrorMessage,
  addingCatalogItemIds,
  canAddTasks,
  detail,
  onAddAllTasks,
  onTaskAdd,
}: PreparationStepDetailProps) {
  return (
    <aside
      aria-live="polite"
      aria-label="이 단계에서 준비할 일"
      className="preparation-step-detail"
      id="preparation-step-detail"
    >
      <div className="preparation-step-detail__panel">
        <header className="preparation-step-detail__header">
          <div className="preparation-step-detail__context">
            <span className="preparation-step-detail__number">
              {detail.numberLabel}
            </span>
            <h2>{detail.title}</h2>
          </div>
          <p>{detail.description}</p>
        </header>

        <div className="preparation-step-detail__content">
          <div className="preparation-step-detail__columns">
            <section
              aria-labelledby="preparation-step-available-tasks-title"
              className={`preparation-step-detail__section${detail.detailTasks.length === 0 ? " preparation-step-detail__section--empty" : ""}`}
            >
              <header className="preparation-step-detail__section-header">
                <h3 id="preparation-step-available-tasks-title">
                  아직 안 담은 일
                </h3>
                <span className="preparation-step-detail__section-count">
                  {detail.detailTasks.length}개
                </span>
              </header>
              {additionErrorMessage ? (
                <p className="preparation-task-list__error" role="alert">
                  {additionErrorMessage}
                </p>
              ) : null}
              <PreparationTaskList
                addingCatalogItemIds={addingCatalogItemIds}
                canAddTasks={canAddTasks}
                isScrollable
                onTaskAdd={onTaskAdd}
                tasks={detail.detailTasks}
                variant="available"
              />
              {detail.detailTasks.length > 0 ? (
                <footer className="preparation-step-detail__section-footer">
                  <PreparationAddAllTasksButton
                    isDisabled={!canAddTasks || addingCatalogItemIds.length > 0}
                    isLoading={addingCatalogItemIds.length > 0}
                    label="모두 추가"
                    onClick={onAddAllTasks}
                    size="compact"
                  />
                </footer>
              ) : null}
            </section>
            <PreparationStepChecklist tasks={detail.checklistTasks} />
          </div>
        </div>
      </div>
    </aside>
  );
}
