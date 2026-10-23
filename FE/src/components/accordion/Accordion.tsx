import {
  createContext,
  useMemo,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ComponentPropsWithRef, KeyboardEvent, ReactNode } from "react";
import { ChevronDown } from "../icons/Chevron";
import "./Accordion.css";

export type AccordionSize = "medium" | "large";
export type AccordionVariant = "inline" | "separated";
export type AccordionType = "single" | "multiple";
export type AccordionHeadingLevel = 2 | 3 | 4 | 5 | 6;

export type AccordionProps = Omit<
  ComponentPropsWithRef<"div">,
  "defaultValue" | "onChange"
> & {
  type?: AccordionType;
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  size?: AccordionSize;
  variant?: AccordionVariant;
  highlight?: boolean;
  headingLevel?: AccordionHeadingLevel;
  disabled?: boolean;
};

export type AccordionItemProps = Omit<
  ComponentPropsWithRef<"div">,
  "title" | "prefix"
> & {
  /** Unique within this Accordion. */
  value: string;
  title: string;
  description?: string;
  /** Decorative content only; interactive elements belong in the panel. */
  prefix?: ReactNode;
  disabled?: boolean;
};

const AccordionContext = createContext<{
  values: string[];
  disabled: boolean;
  headingLevel: AccordionHeadingLevel;
  toggle: (value: string) => void;
} | null>(null);

function AccordionRoot({
  type = "single",
  value,
  defaultValue = [],
  onValueChange,
  size = "medium",
  variant = "inline",
  highlight = true,
  headingLevel = 3,
  disabled = false,
  children,
  className,
  onKeyDown,
  "aria-disabled": ariaDisabled,
  ...props
}: AccordionProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selected = value ?? internalValue;
  const values = useMemo(
    () => (type === "single" ? selected.slice(0, 1) : selected),
    [type, selected],
  );
  const unavailable =
    disabled || ariaDisabled === true || ariaDisabled === "true";

  const toggle = useCallback(
    (itemValue: string) => {
      if (unavailable) return;
      const next = values.includes(itemValue)
        ? values.filter((item) => item !== itemValue)
        : type === "single"
          ? [itemValue]
          : [...values, itemValue];
      if (value === undefined) setInternalValue(next);
      onValueChange?.(next);
    },
    [unavailable, values, type, value, onValueChange],
  );

  const context = useMemo(
    () => ({ values, disabled: unavailable, headingLevel, toggle }),
    [values, unavailable, headingLevel, toggle],
  );

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);
    if (
      event.defaultPrevented ||
      unavailable ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    )
      return;
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const root = event.currentTarget;
    const buttons = Array.from(
      root.querySelectorAll<HTMLButtonElement>(
        "[data-bibbidi-accordion-trigger]",
      ),
    ).filter(
      (button) =>
        !button.disabled && button.closest(".bibbidi-accordion") === root,
    );
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
            buttons.length;
    buttons[next].focus();
  }

  return (
    <AccordionContext.Provider value={context}>
      {/* Keyboard navigation is delegated from native trigger buttons. */}
      {/* eslint-disable-next-line jsx-a11y-x/no-static-element-interactions */}
      <div
        tabIndex={-1}
        {...props}
        className={["bibbidi-accordion", className].filter(Boolean).join(" ")}
        data-size={size}
        data-variant={variant}
        data-highlight={highlight}
        aria-disabled={unavailable || undefined}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

function AccordionItem({
  value,
  title,
  description,
  prefix,
  disabled = false,
  children,
  className,
  "aria-disabled": ariaDisabled,
  ...props
}: AccordionItemProps) {
  const group = useContext(AccordionContext);
  if (!group) throw new Error("Accordion.Item must be used inside Accordion.");
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const open = group.values.includes(value);
  const unavailable =
    group.disabled ||
    disabled ||
    ariaDisabled === true ||
    ariaDisabled === "true";
  const Heading = `h${group.headingLevel}` as "h2" | "h3" | "h4" | "h5" | "h6";

  // A controlled update may close a panel while a link or input inside it has focus.
  useLayoutEffect(() => {
    if (!open && panelRef.current?.contains(document.activeElement)) {
      const trigger = triggerRef.current;
      const root = trigger?.closest<HTMLElement>(".bibbidi-accordion");
      const fallback = Array.from(
        root?.querySelectorAll<HTMLButtonElement>(
          "[data-bibbidi-accordion-trigger]",
        ) ?? [],
      ).find(
        (button) =>
          !button.disabled && button.closest(".bibbidi-accordion") === root,
      );
      (trigger?.disabled ? (fallback ?? root) : trigger)?.focus({
        preventScroll: true,
      });
    }
  }, [open]);

  return (
    <div
      {...props}
      className={["bibbidi-accordion-item", className]
        .filter(Boolean)
        .join(" ")}
      data-state={open ? "open" : "closed"}
      data-disabled={unavailable || undefined}
    >
      <Heading className="bibbidi-accordion-heading">
        <button
          type="button"
          id={`${id}-trigger`}
          ref={triggerRef}
          className="bibbidi-accordion-trigger"
          data-bibbidi-accordion-trigger=""
          disabled={unavailable}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          aria-labelledby={`${id}-title`}
          aria-describedby={description ? `${id}-description` : undefined}
          onClick={() => group.toggle(value)}
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
        </button>
      </Heading>
      <div
        id={`${id}-panel`}
        ref={panelRef}
        className="bibbidi-accordion-panel"
        hidden={!open}
        aria-labelledby={`${id}-trigger`}
      >
        {children}
      </div>
    </div>
  );
}

export const Accordion = Object.assign(AccordionRoot, { Item: AccordionItem });
