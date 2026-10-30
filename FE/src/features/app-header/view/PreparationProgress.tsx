import { ProgressBar } from "../../../components/progress-bar";
import { AppHeaderCategoryProgressViewModel } from "../view-model/createAppHeaderSummaryViewModel";
import "./PreparationProgress.css";

export function PreparationProgress({
  categories,
}: {
  categories: AppHeaderCategoryProgressViewModel[];
}) {
  return (
    <div
      aria-label="카테고리별 준비 현황"
      className="preparation-progress"
      role="region"
    >
      <ul>
        {categories.map((category) => (
          <li key={category.id}>
            <div className="preparation-progress__heading">
              <span className="preparation-progress__category">
                {category.title}
              </span>
              <span className="preparation-progress__count">
                {category.taskCountLabel}
              </span>
            </div>
            <ProgressBar
              aria-label={`${category.title} 완료율`}
              aria-valuetext={category.taskCountLabel}
              progress={category.progress}
              size="normal"
              animate
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
