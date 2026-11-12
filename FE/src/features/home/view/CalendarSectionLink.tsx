import type { ComponentProps } from "react";
import { Link } from "../../../app/navigation/navigation";
import { ChevronRight } from "../../../components/icons/Chevron";
import "./CalendarList.css";

export function CalendarSectionLink({
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, "className">) {
  return (
    <Link {...props} className="calendar-section-link">
      {children}
      <ChevronRight size={16} aria-hidden="true" />
    </Link>
  );
}
