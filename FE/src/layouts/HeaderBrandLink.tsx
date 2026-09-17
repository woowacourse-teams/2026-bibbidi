import { Link } from "react-router";

import { BibidiBrand } from "../components/BibidiBrand/BibidiBrand";
import "./HeaderBrandLink.css";

interface HeaderBrandLinkProps {
  to: string;
}

export function HeaderBrandLink({ to }: HeaderBrandLinkProps) {
  return (
    <Link aria-label="비비디 홈" className="header-brand-link" to={to}>
      <BibidiBrand />
    </Link>
  );
}
