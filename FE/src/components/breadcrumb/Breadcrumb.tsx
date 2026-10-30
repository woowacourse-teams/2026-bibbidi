import type { ComponentPropsWithRef, ReactNode } from "react";
import { ChevronRight } from "../icons/Chevron";
import "./Breadcrumb.css";

export type BreadcrumbProps = Omit<ComponentPropsWithRef<"nav">, "children"> & {
  items: readonly { label: ReactNode }[];
};
export function Breadcrumb({
  items,
  className,
  "aria-label": label = "현재 위치",
  ...props
}: BreadcrumbProps) {
  return (
    <nav
      {...props}
      aria-label={label}
      className={["bibbidi-breadcrumb", className].filter(Boolean).join(" ")}
    >
      <ol>
        {items.map((item, index) => (
          <li key={index}>
            {index > 0 && <ChevronRight size={14} aria-hidden="true" />}
            <span
              aria-current={index === items.length - 1 ? "page" : undefined}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
