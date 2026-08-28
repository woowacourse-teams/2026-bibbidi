import { Link } from "react-router";

import { BibidiBrand } from "../components/BibidiBrand/BibidiBrand";
import "./BrandHeader.css";

export function BrandHeader() {
  return (
    <header className="brand-header">
      <div className="brand-header__inner">
        <Link aria-label="비비디 홈" className="brand-header__link" to="/">
          <BibidiBrand />
        </Link>
      </div>
    </header>
  );
}
