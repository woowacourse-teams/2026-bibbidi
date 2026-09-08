import { useEffect, useState } from "react";
import { PreparationRoadmapViewModel } from "../view-model/createPreparationRoadmapViewModel";
import { PreparationStepBottomSheet } from "./PreparationStepBottomSheet";
import { PreparationStepDetail } from "./PreparationStepDetail";
import { PreparationStepChecklist } from "./PreparationStepChecklist";
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
  onCategorySelect: (categoryId: string) => void;
  onStepSelect: (stepId: string) => void;
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
  onCategorySelect,
  onStepSelect,
  viewModel,
}: PreparationRoadmapProps) {
  const isMobileLayout = useMediaQuery(MOBILE_LAYOUT_MEDIA_QUERY);
  const [mobileOpenStepId, setMobileOpenStepId] = useState<string | null>(null);

  const handleCategorySelect = (categoryId: string) => {
    const changesCategory = viewModel.categories.some(
      (category) => category.id === categoryId && !category.isCurrent,
    );

    if (changesCategory) {
      setMobileOpenStepId(null);
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
        <div className="preparation-roadmap__main">
          <header className="preparation-roadmap__header">
            <h1 id="preparation-roadmap-title">{viewModel.title}</h1>
          </header>

          <div className="preparation-roadmap__grid-wrap">
            <PreparationRoadmapSteps
              isMobileLayout={isMobileLayout}
              onStepSelect={handleStepSelect}
              viewModel={viewModel}
            />
          </div>
        </div>

        {!isMobileLayout ? (
          <div className="preparation-roadmap__sidebar">
            <PreparationStepChecklist
              tasks={viewModel.selectedStepDetail.checklistTasks}
            />
            <PreparationStepDetail detail={viewModel.selectedStepDetail} />
          </div>
        ) : null}
      </section>
      {isMobileLayout && mobileOpenStepId ? (
        <PreparationStepBottomSheet
          detail={viewModel.selectedStepDetail}
          key={mobileOpenStepId}
          onClose={() => setMobileOpenStepId(null)}
        />
      ) : null}
    </div>
  );
}
