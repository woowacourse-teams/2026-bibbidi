import { useId } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import "./PageHeader.css";

export type PageHeaderProps = Omit<
  ComponentPropsWithRef<"header">,
  "title" | "children"
> & {
  title: ReactNode;
  titleId?: string;
  description?: ReactNode;
  navigation?: ReactNode;
  actions?: ReactNode;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
};

/** Page introduction only. The screen owns navigation, actions and outer spacing. */
export function PageHeader({
  title,
  titleId,
  description,
  navigation,
  actions,
  headingLevel = 1,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": labelledBy,
  ...props
}: PageHeaderProps) {
  const id = useId();
  const headingId = titleId ?? `${id}-title`;
  const Heading = `h${headingLevel}` as const;
  return (
    <header
      {...props}
      className={["bibbidi-page-header", className].filter(Boolean).join(" ")}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy ?? (ariaLabel ? undefined : headingId)}
    >
      {navigation != null && (
        <div className="bibbidi-page-header-navigation">{navigation}</div>
      )}
      <div className="bibbidi-page-header-toolbar">
        <div className="bibbidi-page-header-main">
          <Heading id={headingId} className="bibbidi-page-header-title">
            {title}
          </Heading>
          {description != null && (
            <div className="bibbidi-page-header-description">{description}</div>
          )}
        </div>
        {actions != null && (
          <div className="bibbidi-page-header-actions">{actions}</div>
        )}
      </div>
    </header>
  );
}
