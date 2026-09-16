import { HomeScheduleDashboardFeature } from "../features/home";
import "./PlannerPage.css";

export function PlannerPage() {
  return (
    <div className="planner-page">
      <main aria-label="플래너" className="planner-page__content">
        <HomeScheduleDashboardFeature />
      </main>
    </div>
  );
}
