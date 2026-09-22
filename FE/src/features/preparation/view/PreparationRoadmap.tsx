import { useEffect, useState } from "react";
import { PreparationRoadmapViewModel } from "../view-model/createPreparationRoadmapViewModel";
import { PreparationStepBottomSheet } from "./PreparationStepBottomSheet";
import { PreparationStepDetail } from "./PreparationStepDetail";
import "./PreparationRoadmap.css";

const MOBILE_LAYOUT_MEDIA_QUERY = "(max-width: 760px)";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [query]);

  return matches;
}

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
  isMobileLayout: boolean;
  onStepSelect: (stepId: string) => void;
  viewModel: PreparationRoadmapViewModel;
}

function PreparationRoadmapSteps({
  isMobileLayout,
  onStepSelect,
  viewModel,
}: PreparationRoadmapStepsProps) {
  return (
    <ol className="preparation-roadmap__steps">
      {viewModel.steps.map((step) => {
        const stepClassName = [
          "preparation-roadmap__step",
          `preparation-roadmap__step--${step.numberLabel}`,
        ].join(" ");

        return (
          <li className={stepClassName} key={step.id}>
            <button
              aria-controls={
                isMobileLayout ? undefined : "preparation-step-detail"
              }
              aria-haspopup={isMobileLayout ? "dialog" : undefined}
              aria-label={`${step.numberLabel} ${step.title}`}
              aria-pressed={step.isSelected}
              className="preparation-roadmap__step-button"
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
              {!isMobileLayout ? (
                <span
                  aria-hidden="true"
                  className="preparation-roadmap__step-action"
                >
                  할 일 보기 →
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
  const isMobileLayout = useMediaQuery(MOBILE_LAYOUT_MEDIA_QUERY);
  const [mobileOpenStepId, setMobileOpenStepId] = useState<string | null>(null);
  const selectedStepId = viewModel.steps.find((step) => step.isSelected)?.id;

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

    if (!selectedStep || (!isMobileLayout && selectedStep.isSelected)) {
      return;
    }

    setMobileOpenStepId(isMobileLayout ? stepId : null);
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
                ? viewModel.title
                : "로드맵에서 필요한 일만, 내 체크리스트에"}
            </h1>
          </div>
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
        </header>

        <div className="preparation-roadmap__content">
          <div className="preparation-roadmap__main">
            <div className="preparation-roadmap__grid-wrap">
              <PreparationRoadmapSteps
                isMobileLayout={isMobileLayout}
                onStepSelect={handleStepSelect}
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
      {isMobileLayout && mobileOpenStepId ? (
        <PreparationStepBottomSheet
          additionErrorMessage={additionErrorMessage}
          addingCatalogItemIds={addingCatalogItemIds}
          canAddTasks={canAddTasks}
          detail={viewModel.selectedStepDetail}
          key={mobileOpenStepId}
          onAddAllTasks={onAddAllTasks}
          onClose={() => setMobileOpenStepId(null)}
          onTaskAdd={onTaskAdd}
        />
      ) : null}
    </div>
  );
}
