import { HomeScheduleDashboardFeature } from "../features/home";
import "./CalendarPage.css";

export function CalendarPage() {
  return (
    <div className="calendar-page">
      <main aria-label="캘린더" className="calendar-page__content">
        <HomeScheduleDashboardFeature />
      </main>
    </div>
  );
}
