import { useId } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import "./ListHeader.css";

export type ListHeaderHorizontalPadding = "none" | "small" | "medium";
export type ListHeaderProps = Omit<
  ComponentPropsWithRef<"header">,
  "title" | "children"
> & {
  title: ReactNode;
  titleId?: string;
  description?: ReactNode;
  right?: ReactNode;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  horizontalPadding?: ListHeaderHorizontalPadding;
};

/** Section heading and auxiliary content. The owner supplies the section and actions. */
export function ListHeader({
  title,
  titleId,
  description,
  right,
  headingLevel = 2,
  horizontalPadding = "medium",
  className,
  ...props
}: ListHeaderProps) {
  const id = useId();
  const Heading = `h${headingLevel}` as const;
  return (
    <header
      {...props}
      className={["bibbidi-list-header", className].filter(Boolean).join(" ")}
      data-horizontal-padding={horizontalPadding}
    >
      <div className="bibbidi-list-header-main">
        <Heading
          id={titleId ?? `${id}-title`}
          className="bibbidi-list-header-title"
        >
          {title}
        </Heading>
        {description != null && (
          <div className="bibbidi-list-header-description">{description}</div>
        )}
      </div>
      {right != null && (
        <div className="bibbidi-list-header-right">{right}</div>
      )}
    </header>
  );
}
