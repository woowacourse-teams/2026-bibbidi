import { PreparationRoadmapViewModel } from "../view-model/createPreparationRoadmapViewModel";
import { PreparationStepDetail } from "./PreparationStepDetail";
import "./PreparationRoadmap.css";

interface PreparationRoadmapProps {
  viewModel: PreparationRoadmapViewModel;
}

export function PreparationRoadmap({ viewModel }: PreparationRoadmapProps) {
  return (
    <div className="preparation-roadmap">
      <nav
        aria-label="준비 카테고리"
        className="preparation-roadmap__categories"
      >
        <ul className="preparation-roadmap__category-list">
          {viewModel.categories.map((category) => (
            <li key={category.id}>
              <span
                aria-current={category.isCurrent ? "page" : undefined}
                className={`preparation-roadmap__category${
                  category.isCurrent
                    ? " preparation-roadmap__category--current"
                    : ""
                }`}
              >
                {category.label}
              </span>
            </li>
          ))}
        </ul>
      </nav>

      <section
        aria-labelledby="preparation-roadmap-title"
        className="preparation-roadmap__workspace"
      >
        <div className="preparation-roadmap__main">
          <header className="preparation-roadmap__header">
            <h1 id="preparation-roadmap-title">{viewModel.title}</h1>
          </header>

          <div className="preparation-roadmap__grid-wrap">
            <ol className="preparation-roadmap__steps">
              {viewModel.steps.map((step) => (
                <li
                  aria-current={step.isSelected ? "step" : undefined}
                  className={`preparation-roadmap__step preparation-roadmap__step--${step.numberLabel}`}
                  key={step.id}
                >
                  <div className="preparation-roadmap__step-header">
                    <span className="preparation-roadmap__step-number">
                      {step.numberLabel}
                    </span>
                    <span
                      className={`preparation-roadmap__step-status preparation-roadmap__step-status--${step.status}`}
                    >
                      {step.statusLabel}
                    </span>
                  </div>
                  <h2>{step.title}</h2>
                  <p>{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <PreparationStepDetail detail={viewModel.selectedStepDetail} />
      </section>
    </div>
  );
}
