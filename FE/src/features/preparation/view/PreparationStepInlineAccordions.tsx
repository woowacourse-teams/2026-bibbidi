import { PreparationStepDetailViewModel } from "../view-model/createPreparationRoadmapViewModel";
import {
  PreparationAddAllTasksButton,
  PreparationTaskList,
} from "./PreparationTaskList";
import { PreparationStepChecklist } from "./PreparationStepChecklist";
import "./PreparationStepInlineAccordions.css";

interface PreparationStepInlineAccordionsProps {
  additionErrorMessage: string | null;
  addingCatalogItemIds: readonly string[];
  canAddTasks: boolean;
  detail: PreparationStepDetailViewModel;
  id: string;
  onAddAllTasks: () => void;
  onCollapse: () => void;
  onTaskAdd: (catalogItemId: string) => void;
}

export function PreparationStepInlineAccordions({
  additionErrorMessage,
  addingCatalogItemIds,
  canAddTasks,
  detail,
  id,
  onAddAllTasks,
  onCollapse,
  onTaskAdd,
}: PreparationStepInlineAccordionsProps) {
  return (
    <aside
      aria-label="이 단계에서 준비할 일"
      aria-live="polite"
      className="preparation-step-inline-detail"
      id={id}
    >
      <header className="preparation-step-inline-detail__summary">
        {detail.description ? (
          <p className="preparation-step-inline-detail__description">
            {detail.description}
          </p>
        ) : null}
        <button
          className="preparation-step-inline-detail__collapse"
          onClick={onCollapse}
          type="button"
        >
          할 일 접기 <span aria-hidden="true">↑</span>
        </button>
      </header>

      <section className="preparation-step-inline-detail__section">
        <header className="preparation-step-inline-detail__section-header">
          <h3>아직 안 담은 일</h3>
          <span className="preparation-step-inline-detail__count">
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
          density="compact"
          onTaskAdd={onTaskAdd}
          tasks={detail.detailTasks}
          variant="available"
        />
        {detail.detailTasks.length > 0 ? (
          <footer className="preparation-step-inline-detail__footer">
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

      <PreparationStepChecklist
        emptyDescription="위의 아직 안 담은 일에서 필요한 항목을 골라보세요."
        isScrollable={false}
        tasks={detail.checklistTasks}
      />
    </aside>
  );
}
