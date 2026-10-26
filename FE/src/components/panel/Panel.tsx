import type { ComponentPropsWithRef, ReactNode } from "react";
import "./Panel.css";

export type PanelProps = Omit<ComponentPropsWithRef<"div">, "children"> & {
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

export type PanelHeaderProps = Omit<
  ComponentPropsWithRef<"header">,
  "title" | "children"
> & {
  titleId?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
} & (
    | { title: ReactNode; heading?: never }
    | { heading: ReactNode; title?: never }
  );

function Root({ header, children, footer, className, ...props }: PanelProps) {
  return (
    <div
      {...props}
      className={["bibbidi-panel", className].filter(Boolean).join(" ")}
    >
      {header != null && (
        <div className="bibbidi-panel-header-slot">{header}</div>
      )}
      <div className="bibbidi-panel-body">{children}</div>
      {footer != null && <div className="bibbidi-panel-footer">{footer}</div>}
    </div>
  );
}

function Header({
  title,
  heading,
  titleId,
  subtitle,
  actions,
  headingLevel = 2,
  className,
  ...props
}: PanelHeaderProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <header
      {...props}
      className={["bibbidi-panel-header", className].filter(Boolean).join(" ")}
    >
      <div className="bibbidi-panel-heading">
        {heading ?? (
          <Heading id={titleId} className="bibbidi-panel-title">
            {title}
          </Heading>
        )}
        {subtitle != null && (
          <div className="bibbidi-panel-subtitle">{subtitle}</div>
        )}
      </div>
      {actions != null && (
        <div className="bibbidi-panel-header-actions">{actions}</div>
      )}
    </header>
  );
}

/** Visual structure only. The owner supplies the aside or modal landmark. */
export const Panel = Object.assign(Root, { Header });
