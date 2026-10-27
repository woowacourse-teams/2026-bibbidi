import { PageContainer } from "../components/page-container/PageContainer";
import { HomeScheduleDashboardFeature } from "../features/home";
import "./CalendarPage.css";

export function CalendarPage() {
  return (
    <div className="calendar-page">
      <main aria-label="캘린더">
        <PageContainer width="wide" className="calendar-page__content">
          <HomeScheduleDashboardFeature />
        </PageContainer>
      </main>
    </div>
  );
}
