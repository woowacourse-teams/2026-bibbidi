import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  KeyboardEvent,
  ReactElement,
} from "react";
import "./Tab.css";

export type TabSize = "small" | "large";

export type TabProps = Omit<ComponentPropsWithRef<"div">, "onChange"> & {
  /** Direct Tab.Item children (arrays and conditional children are supported). */
  onChange: (index: number, key?: string | number) => void;
  size?: TabSize;
  /** Content-sized items with horizontal scrolling instead of equal widths. */
  fluid?: boolean;
  /** Space between items, in pixels. */
  itemGap?: number;
  ariaLabel?: string;
};

export type TabItemProps = Omit<
  ComponentPropsWithRef<"button">,
  "role" | "aria-selected" | "type"
> & {
  selected: boolean;
  /** Announces an update in addition to displaying a dot. */
  redBean?: boolean;
};

function isUnavailable(
  props: Pick<TabItemProps, "disabled" | "aria-disabled">,
) {
  return (
    props.disabled ||
    props["aria-disabled"] === true ||
    props["aria-disabled"] === "true"
  );
}

function TabItem({
  selected,
  redBean = false,
  className,
  children,
  tabIndex,
  onClick,
  ...props
}: TabItemProps) {
  return (
    <button
      {...props}
      type="button"
      role="tab"
      aria-selected={selected}
      tabIndex={tabIndex ?? (selected ? 0 : -1)}
      className={["bibbidi-tab-item", className].filter(Boolean).join(" ")}
      onClick={(event) => {
        if (isUnavailable(props)) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      <span className="bibbidi-tab-label">
        {children}
        {redBean && <span className="bibbidi-tab-dot" aria-hidden="true" />}
      </span>
      {redBean && <span className="bibbidi-tab-update"> (업데이트 있음)</span>}
    </button>
  );
}

function updateIndicator(track: HTMLDivElement) {
  const selected = track.querySelector<HTMLButtonElement>(
    '[aria-selected="true"]',
  );
  track.style.setProperty(
    "--tab-indicator-left",
    `${selected?.offsetLeft ?? 0}px`,
  );
  track.style.setProperty(
    "--tab-indicator-width",
    `${selected?.offsetWidth ?? 0}px`,
  );
  return selected;
}

function revealTab(root: HTMLDivElement, selected: HTMLButtonElement) {
  // Scroll only the strip; scrollIntoView can also move the entire page.
  if (getComputedStyle(root).direction === "rtl") {
    const itemRect = selected.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    if (itemRect.left < rootRect.left)
      root.scrollLeft += itemRect.left - rootRect.left;
    else if (itemRect.right > rootRect.right)
      root.scrollLeft += itemRect.right - rootRect.right;
  } else if (selected.offsetLeft < root.scrollLeft)
    root.scrollLeft = selected.offsetLeft;
  else if (
    selected.offsetLeft + selected.offsetWidth >
    root.scrollLeft + root.clientWidth
  )
    root.scrollLeft =
      selected.offsetLeft + selected.offsetWidth - root.clientWidth;
}

function TabRoot({
  children,
  onChange,
  size = "large",
  fluid = false,
  itemGap,
  ariaLabel,
  className,
  style,
  ref,
  onKeyDown,
  "aria-label": ariaLabelAttribute,
  ...props
}: TabProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => rootRef.current!, []);

  const items: ReactElement<TabItemProps>[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement<TabItemProps>(child) && child.type === TabItem)
      items.push(child);
  });
  const selectedIndex = items.findIndex((item) => item.props.selected);
  const focusIndex =
    selectedIndex >= 0 && !isUnavailable(items[selectedIndex].props)
      ? selectedIndex
      : items.findIndex((item) => !isUnavailable(item.props));

  const itemIdentity = JSON.stringify(
    items.map((item, index) => item.key ?? item.props.id ?? index),
  );

  // Keep subscriptions for the same DOM items across unrelated screen updates.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    if (!root || !track) return;
    const measure = () => {
      updateIndicator(track);
    };
    measure();
    const frame = requestAnimationFrame(() => {
      track.dataset.ready = "true";
    });
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(root);
    observer?.observe(track);
    for (const item of track.children) observer?.observe(item);
    if (!observer) window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      if (!observer) window.removeEventListener("resize", measure);
    };
  }, [itemIdentity]);

  // Selecting another item reveals it without resetting manual scrolling on every render.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    if (!root || !track) return;
    const selected = updateIndicator(track);
    if (selected) revealTab(root, selected);
  }, [selectedIndex, itemIdentity]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(
      trackRef.current?.children ?? [],
    ) as HTMLButtonElement[];
    const available = buttons.filter(
      (button) =>
        !button.disabled && button.getAttribute("aria-disabled") !== "true",
    );
    const index = available.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const direction =
      getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1;
    const step = (event.key === "ArrowRight" ? 1 : -1) * direction;
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? available.length - 1
          : (index + step + available.length) % available.length;
    const next = available[nextIndex];
    next.focus({ preventScroll: true });
    next.click();
  }

  return (
    <div
      {...props}
      ref={rootRef}
      role="tablist"
      tabIndex={-1}
      aria-orientation="horizontal"
      aria-label={ariaLabelAttribute ?? ariaLabel}
      className={["bibbidi-tab", className].filter(Boolean).join(" ")}
      data-size={size}
      data-fluid={fluid || undefined}
      style={
        {
          ...style,
          ...(itemGap !== undefined
            ? { "--tab-item-gap": `${Math.max(0, itemGap)}px` }
            : {}),
        } as CSSProperties
      }
      onKeyDown={handleKeyDown}
    >
      <div className="bibbidi-tab-track" role="presentation" ref={trackRef}>
        {items.map((item, index) =>
          cloneElement(item, {
            key: item.key ?? index,
            id: item.props.id ?? `${id}-tab-${index}`,
            tabIndex: index === focusIndex ? 0 : -1,
            onClick: (event) => {
              if (isUnavailable(item.props)) return;
              item.props.onClick?.(event);
              if (!event.defaultPrevented && !item.props.selected)
                onChange(index, item.key ?? undefined);
            },
          }),
        )}
      </div>
    </div>
  );
}

export const Tab = Object.assign(TabRoot, { Item: TabItem });
