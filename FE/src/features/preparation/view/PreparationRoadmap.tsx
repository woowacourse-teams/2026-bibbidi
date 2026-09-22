import { useState } from "react";
import { useIsMobileLayout } from "../../../shared/responsive";
import { PreparationRoadmapViewModel } from "../view-model/createPreparationRoadmapViewModel";
import { PreparationStepDetail } from "./PreparationStepDetail";
import { PreparationStepInlineAccordions } from "./PreparationStepInlineAccordions";
import "./PreparationRoadmap.css";

interface PreparationRoadmapProps {
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
  isMobileLayout: boolean;
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
  isMobileLayout,
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
        const isExpanded =
          isMobileLayout && expandedStepId === step.id && step.isSelected;
        const stepClassName = [
          "preparation-roadmap__step",
          `preparation-roadmap__step--${step.numberLabel}`,
          isExpanded ? "preparation-roadmap__step--expanded" : "",
        ].join(" ");

        return (
          <li className={stepClassName} key={step.id}>
            <button
              aria-controls={
                isMobileLayout
                  ? isExpanded
                    ? detailId
                    : undefined
                  : "preparation-step-detail"
              }
              aria-expanded={isMobileLayout ? isExpanded : undefined}
              aria-label={`${step.numberLabel} ${step.title}`}
              aria-pressed={isMobileLayout ? isExpanded : step.isSelected}
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
              {!isMobileLayout || !isExpanded ? (
                <span
                  aria-hidden="true"
                  className="preparation-roadmap__step-action"
                >
                  {isMobileLayout ? "할 일 고르기 ↓" : "할 일 보기 →"}
                </span>
              ) : null}
              {step.iconUrl ? (
                <img
                  alt=""
                  className="preparation-roadmap__step-icon"
                  onError={(event) => {
                    event.currentTarget.hidden = true;
                  }}
                  src={step.iconUrl}
                />
              ) : null}
            </button>
            {isExpanded ? (
              <PreparationStepInlineAccordions
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
  additionErrorMessage,
  addingCatalogItemIds,
  canAddTasks,
  onAddAllTasks,
  onCategorySelect,
  onStepSelect,
  onTaskAdd,
  viewModel,
}: PreparationRoadmapProps) {
  const isMobileLayout = useIsMobileLayout();
  const [mobileOpenStepId, setMobileOpenStepId] = useState<string | null>(null);
  const selectedStepId = viewModel.steps.find((step) => step.isSelected)?.id;
  const expandedStepId =
    isMobileLayout && mobileOpenStepId === selectedStepId
      ? mobileOpenStepId
      : null;

  const handleCategorySelect = (categoryId: string) => {
    const changesCategory = viewModel.categories.some(
      (category) => category.id === categoryId && !category.isCurrent,
    );

    if (changesCategory) {
      setMobileOpenStepId(null);

      if (isMobileLayout) {
        const scrollContainer = document.querySelector<HTMLElement>(
          "[data-page-scroll-container]",
        );

        if (scrollContainer) {
          scrollContainer.scrollTop = 0;
        }
      }
    }

    onCategorySelect(categoryId);
  };

  const handleStepSelect = (stepId: string) => {
    const selectedStep = viewModel.steps.find((step) => step.id === stepId);

    if (!selectedStep) {
      return;
    }

    if (isMobileLayout) {
      if (mobileOpenStepId === stepId) {
        setMobileOpenStepId(null);
        return;
      }

      setMobileOpenStepId(stepId);
      onStepSelect(stepId);
      return;
    }

    setMobileOpenStepId(null);

    if (selectedStep.isSelected) {
      return;
    }

    onStepSelect(stepId);
  };

  return (
    <div className="preparation-roadmap">
      <nav
        aria-label="준비 카테고리"
        className="preparation-roadmap__categories"
      >
        <ul className="preparation-roadmap__category-list">
          {viewModel.categories.map((category) => (
            <li key={category.id}>
              <button
                aria-controls="preparation-roadmap-content"
                aria-pressed={category.isCurrent}
                className={`preparation-roadmap__category${
                  category.isCurrent
                    ? " preparation-roadmap__category--current"
                    : ""
                }`}
                onClick={() => handleCategorySelect(category.id)}
                type="button"
              >
                {category.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <section
        aria-labelledby="preparation-roadmap-title"
        className="preparation-roadmap__workspace"
        id="preparation-roadmap-content"
      >
        <header className="preparation-roadmap__header">
          <div className="preparation-roadmap__header-copy">
            <h1 id="preparation-roadmap-title">
              {isMobileLayout
                ? "준비할 단계를 선택해 보세요."
                : "로드맵에서 필요한 일만, 내 체크리스트에"}
            </h1>
            {isMobileLayout ? (
              <p>필요한 할 일을 골라 내 체크리스트에 담을 수 있어요.</p>
            ) : null}
          </div>
          {!isMobileLayout ? (
            <ol
              aria-label="체크리스트 만드는 순서"
              className="preparation-roadmap__guide"
            >
              <li>
                <span aria-hidden="true">1</span>
                단계 선택
              </li>
              <li>
                <span aria-hidden="true">2</span>할 일 추가
              </li>
              <li>
                <span aria-hidden="true">3</span>
                체크리스트에서 관리
              </li>
            </ol>
          ) : null}
        </header>

        <div className="preparation-roadmap__content">
          <div className="preparation-roadmap__main">
            <div className="preparation-roadmap__grid-wrap">
              <PreparationRoadmapSteps
                additionErrorMessage={additionErrorMessage}
                addingCatalogItemIds={addingCatalogItemIds}
                canAddTasks={canAddTasks}
                expandedStepId={expandedStepId}
                isMobileLayout={isMobileLayout}
                onAddAllTasks={onAddAllTasks}
                onStepSelect={handleStepSelect}
                onTaskAdd={onTaskAdd}
                viewModel={viewModel}
              />
            </div>
          </div>

          {!isMobileLayout ? (
            <PreparationStepDetail
              additionErrorMessage={additionErrorMessage}
              addingCatalogItemIds={addingCatalogItemIds}
              canAddTasks={canAddTasks}
              detail={viewModel.selectedStepDetail}
              key={selectedStepId}
              onAddAllTasks={onAddAllTasks}
              onTaskAdd={onTaskAdd}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
