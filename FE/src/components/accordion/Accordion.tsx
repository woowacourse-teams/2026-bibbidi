import { useId } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { ChevronDown } from "../icons/Chevron";
import { AccordionPrimitive } from "./AccordionPrimitive";
import type { AccordionPrimitiveRootProps } from "./AccordionPrimitive";
import "./Accordion.css";

export type {
  AccordionType,
  AccordionHeadingLevel,
} from "./AccordionPrimitive";
export type AccordionSize = "medium" | "large";
export type AccordionVariant = "inline" | "separated";
export type AccordionProps = AccordionPrimitiveRootProps & {
  size?: AccordionSize;
  variant?: AccordionVariant;
  highlight?: boolean;
};
export type AccordionItemProps = Omit<
  ComponentPropsWithRef<"div">,
  "title" | "prefix"
> & {
  value: string;
  title: string;
  description?: string;
  /** Decorative content only; interactive elements belong in the panel. */
  prefix?: ReactNode;
  disabled?: boolean;
};

function AccordionRoot({
  size = "medium",
  variant = "inline",
  highlight = true,
  className,
  ...props
}: AccordionProps) {
  return (
    <AccordionPrimitive.Root
      {...props}
      className={["bibbidi-accordion", className].filter(Boolean).join(" ")}
      data-size={size}
      data-variant={variant}
      data-highlight={highlight}
    />
  );
}

function AccordionItem({
  value,
  title,
  description,
  prefix,
  children,
  className,
  ...props
}: AccordionItemProps) {
  const id = useId();
  return (
    <AccordionPrimitive.Item
      {...props}
      value={value}
      className={["bibbidi-accordion-item", className]
        .filter(Boolean)
        .join(" ")}
    >
      <AccordionPrimitive.Header className="bibbidi-accordion-heading">
        <AccordionPrimitive.Trigger
          className="bibbidi-accordion-trigger"
          aria-labelledby={`${id}-title`}
          aria-describedby={description ? `${id}-description` : undefined}
        >
          {prefix != null && (
            <span className="bibbidi-accordion-prefix" aria-hidden="true">
              {prefix}
            </span>
          )}
          <span className="bibbidi-accordion-text">
            <span id={`${id}-title`} className="bibbidi-accordion-title">
              {title}
            </span>
            {description && (
              <span
                id={`${id}-description`}
                className="bibbidi-accordion-description"
              >
                {description}
              </span>
            )}
          </span>
          <ChevronDown
            className="bibbidi-accordion-chevron"
            aria-hidden="true"
          />
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content className="bibbidi-accordion-panel">
        {children}
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
}

export const Accordion = Object.assign(AccordionRoot, { Item: AccordionItem });
