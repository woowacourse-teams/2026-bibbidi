import { PageContainer } from "../components/page-container/PageContainer";
import { HomeScheduleDashboardFeature } from "../features/home";
import { useHydrated } from "../shared/browser/useHydrated";
import "./CalendarPage.css";

export function CalendarPage() {
  const hydrated = useHydrated();
  return (
    <div className="calendar-page">
      <main aria-label="캘린더">
        <PageContainer width="wide" className="calendar-page__content">
          {hydrated ? (
            <HomeScheduleDashboardFeature />
          ) : (
            <p role="status">일정을 불러오고 있어요.</p>
          )}
        </PageContainer>
      </main>
    </div>
  );
}
