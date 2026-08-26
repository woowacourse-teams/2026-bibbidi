import { Link } from "react-router";

import { BibidiBrand } from "../components/BibidiBrand/BibidiBrand";
import { AppHeader } from "../layouts/AppHeader";
import "./HomePage.css";

export function HomePage() {
  const homeLink = (
    <Link
      aria-current="page"
      aria-label="비비디 홈"
      className="app-header__brand"
      to="/"
    >
      <BibidiBrand />
    </Link>
  );

  return (
    <div className="home-page">
      <AppHeader homeLink={homeLink} />
      <main aria-label="홈 콘텐츠" className="home-page__content" />
    </div>
  );
}
