import { useEffect, useRef, useState } from "react";
import { PreparationCategoryNavigationDirection } from "../model/preparationRoadmap";
import { PreparationRoadmapViewModel } from "../view-model/createPreparationRoadmapViewModel";
import { PreparationStepDetail } from "./PreparationStepDetail";
import "./PreparationRoadmap.css";

const WHEEL_DELTA_THRESHOLD = 80;
const WHEEL_GESTURE_RESET_MS = 160;
const WHEEL_LINE_HEIGHT_PX = 16;
const COMPACT_LAYOUT_MEDIA_QUERY = "(max-width: 1439px)";
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

interface WheelGestureState {
  accumulatedDelta: number;
  hasNavigated: boolean;
}

function getNormalizedWheelDelta(
  event: WheelEvent,
  pageHeight: number,
): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return event.deltaY * WHEEL_LINE_HEIGHT_PX;
  }

  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * pageHeight;
  }

  return event.deltaY;
}

interface PreparationRoadmapProps {
  mobileExpandedStepId: string | null;
  onCategoryNavigate: (
    direction: PreparationCategoryNavigationDirection,
  ) => void;
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
                    {step.numberLabel}
                  </span>
                  <span
                    className={`preparation-roadmap__step-status preparation-roadmap__step-status--${step.status}`}
                  >
                    {step.statusLabel}
                  </span>
                </span>
                <span className="preparation-roadmap__step-title">
                  {step.title}
                </span>
                <span className="preparation-roadmap__step-description">
                  {step.description}
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
  onCategoryNavigate,
  onCategorySelect,
  onStepSelect,
  viewModel,
}: PreparationRoadmapProps) {
  const isCompactLayout = useMediaQuery(COMPACT_LAYOUT_MEDIA_QUERY);
  const isMobileLayout = useMediaQuery(MOBILE_LAYOUT_MEDIA_QUERY);
  const categoryNavigationRef = useRef(viewModel.categoryNavigation);
  const gestureResetTimerRef = useRef<number | undefined>(undefined);
  const onCategoryNavigateRef = useRef(onCategoryNavigate);
  const roadmapMainRef = useRef<HTMLDivElement>(null);
  const wheelGestureRef = useRef<WheelGestureState>({
    accumulatedDelta: 0,
    hasNavigated: false,
  });

  useEffect(() => {
    categoryNavigationRef.current = viewModel.categoryNavigation;
  }, [viewModel.categoryNavigation]);

  useEffect(() => {
    onCategoryNavigateRef.current = onCategoryNavigate;
  }, [onCategoryNavigate]);

  useEffect(() => {
    const roadmapMain = roadmapMainRef.current;

    if (!roadmapMain || isCompactLayout) {
      return;
    }

    const resetWheelGesture = () => {
      wheelGestureRef.current = {
        accumulatedDelta: 0,
        hasNavigated: false,
      };
      gestureResetTimerRef.current = undefined;
    };

    const scheduleGestureReset = () => {
      if (gestureResetTimerRef.current !== undefined) {
        window.clearTimeout(gestureResetTimerRef.current);
      }

      gestureResetTimerRef.current = window.setTimeout(
        resetWheelGesture,
        WHEEL_GESTURE_RESET_MS,
      );
    };

    const handleRoadmapWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return;
      }

      scheduleGestureReset();

      if (wheelGestureRef.current.hasNavigated) {
        event.preventDefault();
        return;
      }

      const normalizedDelta = getNormalizedWheelDelta(
        event,
        roadmapMain.clientHeight,
      );
      const direction = normalizedDelta > 0 ? "next" : "previous";
      const canNavigate =
        direction === "next"
          ? categoryNavigationRef.current.canNavigateNext
          : categoryNavigationRef.current.canNavigatePrevious;

      if (!canNavigate) {
        wheelGestureRef.current.accumulatedDelta = 0;
        return;
      }

      event.preventDefault();

      if (
        Math.sign(wheelGestureRef.current.accumulatedDelta) !== 0 &&
        Math.sign(wheelGestureRef.current.accumulatedDelta) !==
          Math.sign(normalizedDelta)
      ) {
        wheelGestureRef.current.accumulatedDelta = 0;
      }

      wheelGestureRef.current.accumulatedDelta += normalizedDelta;

      if (
        Math.abs(wheelGestureRef.current.accumulatedDelta) <
        WHEEL_DELTA_THRESHOLD
      ) {
        return;
      }

      wheelGestureRef.current.hasNavigated = true;
      onCategoryNavigateRef.current(direction);
    };

    roadmapMain.addEventListener("wheel", handleRoadmapWheel, {
      passive: false,
    });

    return () => {
      roadmapMain.removeEventListener("wheel", handleRoadmapWheel);

      if (gestureResetTimerRef.current !== undefined) {
        window.clearTimeout(gestureResetTimerRef.current);
      }

      resetWheelGesture();
    };
  }, [isCompactLayout]);

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
        <div className="preparation-roadmap__main" ref={roadmapMainRef}>
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
