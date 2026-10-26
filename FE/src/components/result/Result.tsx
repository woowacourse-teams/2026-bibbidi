import { useId, type ComponentPropsWithRef, type ReactNode } from "react";
import { Button, type ButtonProps } from "../button";
import "./Result.css";

function hasContent(value: ReactNode) {
  return value != null && value !== false && value !== "";
}

export type ResultProps = Omit<
  ComponentPropsWithRef<"section">,
  "title" | "children" | "aria-labelledby" | "aria-describedby"
> & {
  title: ReactNode;
  figure?: ReactNode;
  description?: ReactNode;
  button?: ReactNode;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
};

function ResultRoot({
  title,
  figure,
  description,
  button,
  headingLevel = 2,
  className,
  ...props
}: ResultProps) {
  const id = useId();
  const Heading = `h${headingLevel}` as const;
  const hasDescription = hasContent(description);

  return (
    <section
      {...props}
      className={["bibbidi-result", className].filter(Boolean).join(" ")}
      aria-labelledby={`${id}-title`}
      aria-describedby={hasDescription ? `${id}-description` : undefined}
    >
      {hasContent(figure) && (
        <div className="bibbidi-result-figure" aria-hidden="true" inert>
          {figure}
        </div>
      )}
      <Heading id={`${id}-title`} className="bibbidi-result-title">
        {title}
      </Heading>
      {hasDescription && (
        <div id={`${id}-description`} className="bibbidi-result-description">
          {description}
        </div>
      )}
      {hasContent(button) && (
        <div className="bibbidi-result-button">{button}</div>
      )}
    </section>
  );
}

export type ResultButtonProps = ButtonProps;

function ResultButton({
  size = "medium",
  color = "dark",
  variant = "weak",
  ...props
}: ResultButtonProps) {
  return <Button size={size} color={color} variant={variant} {...props} />;
}

export const Result = Object.assign(ResultRoot, { Button: ResultButton });
