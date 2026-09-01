import { useEffect, useState } from "react";
import { PreparationRoadmapViewModel } from "../view-model/createPreparationRoadmapViewModel";
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
  mobileExpandedStepId: string | null;
  onCategorySelect: (categoryId: string) => void;
  onStepSelect: (
    stepId: string,
    options: { expandsMobileDetail: boolean },
  ) => void;
  viewModel: PreparationRoadmapViewModel;
}

interface PreparationRoadmapStepsProps {
  isMobileLayout: boolean;
  mobileExpandedStepId: string | null;
  onStepSelect: (
    stepId: string,
    options: { expandsMobileDetail: boolean },
  ) => void;
  viewModel: PreparationRoadmapViewModel;
}

function PreparationRoadmapSteps({
  isMobileLayout,
  mobileExpandedStepId,
  onStepSelect,
  viewModel,
}: PreparationRoadmapStepsProps) {
  return (
    <ol className="preparation-roadmap__steps">
      {viewModel.steps.map((step) => {
        const showsMobileDetail =
          isMobileLayout && mobileExpandedStepId === step.id;

        return (
          <li
            className={`preparation-roadmap__step preparation-roadmap__step--${step.numberLabel}`}
            key={step.id}
          >
            {showsMobileDetail ? (
              <PreparationStepDetail
                detail={viewModel.selectedStepDetail}
                focusOnMount
              />
            ) : (
              <button
                aria-controls="preparation-step-detail"
                aria-pressed={!isMobileLayout && step.isSelected}
                className="preparation-roadmap__step-button"
                onClick={() =>
                  onStepSelect(step.id, {
                    expandsMobileDetail: isMobileLayout,
                  })
                }
                type="button"
              >
                <span className="preparation-roadmap__step-header">
                  <span className="preparation-roadmap__step-number">
                    {step.numberLabel}.
                  </span>
                </span>
                <span className="preparation-roadmap__step-title">
                  {step.title}
                </span>
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function PreparationRoadmap({
  mobileExpandedStepId,
  onCategorySelect,
  onStepSelect,
  viewModel,
}: PreparationRoadmapProps) {
  const isMobileLayout = useMediaQuery(MOBILE_LAYOUT_MEDIA_QUERY);

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
                aria-current={category.isCurrent ? "page" : undefined}
                aria-pressed={category.isCurrent}
                className={`preparation-roadmap__category${
                  category.isCurrent
                    ? " preparation-roadmap__category--current"
                    : ""
                }`}
                onClick={() => onCategorySelect(category.id)}
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
              mobileExpandedStepId={mobileExpandedStepId}
              onStepSelect={onStepSelect}
              viewModel={viewModel}
            />
          </div>
        </div>

        {!isMobileLayout ? (
          <PreparationStepDetail detail={viewModel.selectedStepDetail} />
        ) : null}
      </section>
    </div>
  );
}
