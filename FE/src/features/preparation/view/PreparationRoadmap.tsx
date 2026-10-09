import { ReactNode, useRef, useState } from "react";
import { PreparationRoadmapViewModel } from "../view-model/createPreparationRoadmapViewModel";
import { PreparationStepInlineDetail } from "./PreparationStepInlineDetail";
import { RoadmapCategoryTabs } from "./RoadmapCategoryTabs";
import "./PreparationRoadmap.css";

interface PreparationRoadmapProps {
  header: ReactNode;
  additionErrorMessage: string | null;
  addingCatalogItemIds: readonly string[];
  canAddTasks: boolean;
  onAddAllTasks: () => void;
  onCategorySelect: (categoryId: string) => void;
  onStepSelect: (stepId: string) => void;
  onTaskAdd: (catalogItemId: string) => void;
  viewModel: PreparationRoadmapViewModel;
}

interface PreparationRoadmapStepsProps {
  additionErrorMessage: string | null;
  addingCatalogItemIds: readonly string[];
  canAddTasks: boolean;
  expandedStepId: string | null;
  onAddAllTasks: () => void;
  onStepSelect: (stepId: string) => void;
  onTaskAdd: (catalogItemId: string) => void;
  viewModel: PreparationRoadmapViewModel;
}

function PreparationRoadmapSteps({
  additionErrorMessage,
  addingCatalogItemIds,
  canAddTasks,
  expandedStepId,
  onAddAllTasks,
  onStepSelect,
  onTaskAdd,
  viewModel,
}: PreparationRoadmapStepsProps) {
  return (
    <ol className="preparation-roadmap__steps">
      {viewModel.steps.map((step) => {
        const detailId = `preparation-step-detail-${step.id}`;
        const triggerId = `preparation-step-trigger-${step.id}`;
        const isExpanded = expandedStepId === step.id && step.isSelected;
        const stepClassName = [
          "preparation-roadmap__step",
          isExpanded ? "preparation-roadmap__step--expanded" : "",
        ].join(" ");

        return (
          <li className={stepClassName} key={step.id}>
            <button
              aria-controls={isExpanded ? detailId : undefined}
              aria-expanded={isExpanded}
              aria-label={`${step.numberLabel} ${step.title}`}
              aria-pressed={isExpanded}
              className="preparation-roadmap__step-button"
              id={triggerId}
              onClick={() => onStepSelect(step.id)}
              type="button"
            >
              <span className="preparation-roadmap__step-header">
                <span className="preparation-roadmap__step-number">
                  {step.numberLabel}
                </span>
              </span>
              <span className="preparation-roadmap__step-title">
                {step.title}
              </span>
              {!isExpanded ? (
                <span
                  aria-hidden="true"
                  className="preparation-roadmap__step-action"
                >
                  할 일 고르기 ↓
                </span>
              ) : null}
              {step.iconUrl ? (
                <img
                  alt=""
                  className="preparation-roadmap__step-icon"
                  draggable={false}
                  onError={(event) => {
                    event.currentTarget.hidden = true;
                  }}
                  src={step.iconUrl}
                />
              ) : null}
            </button>
            {isExpanded ? (
              <PreparationStepInlineDetail
                additionErrorMessage={additionErrorMessage}
                addingCatalogItemIds={addingCatalogItemIds}
                canAddTasks={canAddTasks}
                detail={viewModel.selectedStepDetail}
                id={detailId}
                onAddAllTasks={onAddAllTasks}
                onCollapse={() => {
                  document.getElementById(triggerId)?.focus();
                  onStepSelect(step.id);
                }}
                onTaskAdd={onTaskAdd}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function PreparationRoadmap({
  header,
  additionErrorMessage,
  addingCatalogItemIds,
  canAddTasks,
  onAddAllTasks,
  onCategorySelect,
  onStepSelect,
  onTaskAdd,
  viewModel,
}: PreparationRoadmapProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [openStepId, setOpenStepId] = useState<string | null>(null);
  const selectedStepId = viewModel.steps.find((step) => step.isSelected)?.id;
  const expandedStepId = openStepId === selectedStepId ? openStepId : null;

  const handleCategorySelect = (categoryId: string) => {
    const changesCategory = viewModel.categories.some(
      (category) => category.id === categoryId && !category.isCurrent,
    );

    if (changesCategory) {
      setOpenStepId(null);

      if (listRef.current) listRef.current.scrollTop = 0;
    }

    onCategorySelect(categoryId);
  };

  const handleStepSelect = (stepId: string) => {
    const selectedStep = viewModel.steps.find((step) => step.id === stepId);

    if (!selectedStep) {
      return;
    }

    if (openStepId === stepId) {
      setOpenStepId(null);
      return;
    }
    setOpenStepId(stepId);
    onStepSelect(stepId);
  };

  return (
    <div className="preparation-roadmap">
      <RoadmapCategoryTabs
        categories={viewModel.categories}
        selectedCategoryId={
          viewModel.categories.find((category) => category.isCurrent)?.id
        }
        controlsId="preparation-roadmap-content"
        onCategorySelect={handleCategorySelect}
      />

      <section
        aria-labelledby="preparation-roadmap-title"
        className="preparation-roadmap__workspace"
        id="preparation-roadmap-content"
      >
        {header}

        <div className="preparation-roadmap__content">
          <div className="preparation-roadmap__main">
            <div
              className="preparation-roadmap__grid-wrap"
              ref={listRef}
              role="region"
              aria-label="전체 단계 목록"
              // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- 목록을 키보드로 스크롤할 수 있도록 포커스를 허용한다.
              tabIndex={0}
            >
              <PreparationRoadmapSteps
                additionErrorMessage={additionErrorMessage}
                addingCatalogItemIds={addingCatalogItemIds}
                canAddTasks={canAddTasks}
                expandedStepId={expandedStepId}
                onAddAllTasks={onAddAllTasks}
                onStepSelect={handleStepSelect}
                onTaskAdd={onTaskAdd}
                viewModel={viewModel}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
