import { HomeScheduleDashboardFeature } from "../features/home";
import "./HomePage.css";

export function HomePage() {
  return (
    <div className="home-page">
      <main aria-label="홈 콘텐츠" className="home-page__content">
        <HomeScheduleDashboardFeature />
      </main>
    </div>
  );
}
