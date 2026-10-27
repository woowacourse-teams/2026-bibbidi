import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronRight } from "../../../components/icons/Chevron";
import "./CalendarList.css";

export function CalendarSectionLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className="calendar-section-link">
      {children}
      <ChevronRight size={16} aria-hidden="true" />
    </Link>
  );
}
