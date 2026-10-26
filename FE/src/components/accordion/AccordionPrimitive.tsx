import {
  createContext,
  useCallback,
  useContext,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ComponentPropsWithRef, KeyboardEvent, RefObject } from "react";

export type AccordionType = "single" | "multiple";
export type AccordionHeadingLevel = 2 | 3 | 4 | 5 | 6;
export type AccordionPrimitiveRootProps = Omit<
  ComponentPropsWithRef<"div">,
  "defaultValue" | "onChange"
> & {
  type?: AccordionType;
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  headingLevel?: AccordionHeadingLevel;
  disabled?: boolean;
};
export type AccordionPrimitiveItemProps = ComponentPropsWithRef<"div"> & {
  value: string;
  disabled?: boolean;
};
export type AccordionPrimitiveHeaderProps = ComponentPropsWithRef<"h3">;
export type AccordionPrimitiveTriggerProps = Omit<
  ComponentPropsWithRef<"button">,
  "id" | "type" | "disabled" | "aria-expanded" | "aria-controls"
>;
export type AccordionPrimitiveContentProps = Omit<
  ComponentPropsWithRef<"div">,
  "id" | "hidden"
>;

type GroupContext = {
  values: string[];
  disabled: boolean;
  headingLevel: AccordionHeadingLevel;
  rootRef: RefObject<HTMLDivElement | null>;
  toggle: (value: string) => void;
};
type ItemContext = {
  open: boolean;
  disabled: boolean;
  headingLevel: AccordionHeadingLevel;
  triggerId: string;
  contentId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  toggle: () => void;
};
const Group = createContext<GroupContext | null>(null);
const Item = createContext<ItemContext | null>(null);

function useAccordionItem() {
  const item = useContext(Item);
  if (!item)
    throw new Error(
      "Accordion parts must be used inside AccordionPrimitive.Item.",
    );
  return item;
}

function AccordionRoot({
  type = "single",
  value,
  defaultValue = [],
  onValueChange,
  headingLevel = 3,
  disabled = false,
  onKeyDown,
  ref,
  "aria-disabled": ariaDisabled,
  ...props
}: AccordionPrimitiveRootProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => rootRef.current!, []);
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
    () => ({ values, disabled: unavailable, headingLevel, rootRef, toggle }),
    [values, unavailable, headingLevel, toggle],
  );

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);
    if (
      event.defaultPrevented ||
      unavailable ||
      event.nativeEvent.isComposing ||
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
        !button.disabled &&
        button.closest("[data-bibbidi-accordion-root]") === root,
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
    <Group.Provider value={context}>
      {/* Keyboard navigation is delegated from native trigger buttons. */}
      {/* eslint-disable-next-line jsx-a11y-x/no-static-element-interactions */}
      <div
        tabIndex={-1}
        {...props}
        ref={rootRef}
        data-bibbidi-accordion-root=""
        aria-disabled={unavailable || undefined}
        onKeyDown={handleKeyDown}
      />
    </Group.Provider>
  );
}

function AccordionItem({
  value,
  disabled = false,
  "aria-disabled": ariaDisabled,
  ...props
}: AccordionPrimitiveItemProps) {
  const group = useContext(Group);
  if (!group)
    throw new Error(
      "AccordionPrimitive.Item must be used inside AccordionPrimitive.Root.",
    );
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const open = group.values.includes(value);
  const unavailable =
    group.disabled ||
    disabled ||
    ariaDisabled === true ||
    ariaDisabled === "true";
  const { rootRef, toggle, headingLevel } = group;
  const context = useMemo(
    () => ({
      open,
      disabled: unavailable,
      headingLevel,
      triggerId: `${id}-trigger`,
      contentId: `${id}-panel`,
      triggerRef,
      contentRef,
      toggle: () => toggle(value),
    }),
    [open, unavailable, headingLevel, id, toggle, value],
  );

  // Keep focus visible when an external update hides the focused content.
  useLayoutEffect(() => {
    if (!open && contentRef.current?.contains(document.activeElement)) {
      const root = rootRef.current;
      const trigger = triggerRef.current;
      const fallback = Array.from(
        root?.querySelectorAll<HTMLButtonElement>(
          "[data-bibbidi-accordion-trigger]",
        ) ?? [],
      ).find(
        (button) =>
          !button.disabled &&
          button.closest("[data-bibbidi-accordion-root]") === root,
      );
      (trigger?.disabled ? (fallback ?? root) : trigger)?.focus({
        preventScroll: true,
      });
    }
  }, [open, rootRef]);

  return (
    <Item.Provider value={context}>
      <div
        {...props}
        data-state={open ? "open" : "closed"}
        aria-disabled={unavailable || undefined}
        data-disabled={unavailable || undefined}
      />
    </Item.Provider>
  );
}

function AccordionHeader(props: AccordionPrimitiveHeaderProps) {
  const { headingLevel } = useAccordionItem();
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4" | "h5" | "h6";
  return <Heading {...props} />;
}

function AccordionTrigger({
  ref,
  onClick,
  ...props
}: AccordionPrimitiveTriggerProps) {
  const { triggerRef, triggerId, contentId, open, disabled, toggle } =
    useAccordionItem();
  useImperativeHandle(ref, () => triggerRef.current!, [triggerRef]);
  return (
    <button
      {...props}
      type="button"
      ref={triggerRef}
      id={triggerId}
      data-bibbidi-accordion-trigger=""
      data-state={open ? "open" : "closed"}
      disabled={disabled}
      aria-expanded={open}
      aria-controls={contentId}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && !disabled) toggle();
      }}
    />
  );
}

function AccordionContent({
  ref,
  style,
  "aria-labelledby": labelledBy,
  ...props
}: AccordionPrimitiveContentProps) {
  const { contentRef, contentId, triggerId, open } = useAccordionItem();
  useImperativeHandle(ref, () => contentRef.current!, [contentRef]);
  return (
    <div
      {...props}
      ref={contentRef}
      id={contentId}
      hidden={!open}
      style={open ? style : { ...style, display: "none" }}
      aria-labelledby={labelledBy ?? triggerId}
      data-state={open ? "open" : "closed"}
    />
  );
}

/** Behavior and semantics only; consumers own the visual composition. */
export const AccordionPrimitive = {
  Root: AccordionRoot,
  Item: AccordionItem,
  Header: AccordionHeader,
  Trigger: AccordionTrigger,
  Content: AccordionContent,
};
