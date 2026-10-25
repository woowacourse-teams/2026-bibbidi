import {
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  KeyboardEvent,
  ReactElement,
  ReactNode,
} from "react";
import { CheckIcon } from "../icons/ActionIcons";
import { containTabFocus } from "../../shared/focus/containTabFocus";
import { getMenuPosition } from "./placement";
import type { MenuPlacement } from "./placement";
import "./Menu.css";

export type MenuProps = {
  /** A button, Button, or IconButton that forwards native button props and its ref. */
  trigger: ReactElement<ComponentPropsWithRef<"button">>;
  children: ReactNode;
  "aria-label": string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: MenuPlacement;
  width?: number;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
};
export type MenuItemProps = Omit<
  ComponentPropsWithRef<"button">,
  "onSelect" | "role" | "type" | "tabIndex" | "aria-checked" | "prefix"
> & {
  children: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
  description?: string;
  textValue?: string;
  tone?: "default" | "critical";
  onSelect?: () => void;
  closeOnSelect?: boolean;
};
export type MenuCheckboxItemProps = Omit<MenuItemProps, "tone" | "onSelect"> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
};
const MenuContext = createContext<(() => void) | null>(null);

function Root({
  trigger,
  children,
  "aria-label": label,
  open,
  defaultOpen = false,
  onOpenChange,
  placement = "bottom-start",
  width = 240,
  disabled = false,
  className,
  style,
}: MenuProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const unavailable =
    disabled ||
    trigger.props.disabled ||
    trigger.props["aria-disabled"] === true ||
    trigger.props["aria-disabled"] === "true";
  const isOpen = (open ?? internalOpen) && !unavailable;
  if (unavailable && internalOpen) setInternalOpen(false);
  const firstFocus = useRef<"first" | "last">("first");
  const search = useRef({ text: "", time: 0 });
  const [position, setPosition] = useState<CSSProperties>({
    position: "fixed",
  });
  const [resolvedPlacement, setResolvedPlacement] = useState<string>(placement);
  const setOpen = useCallback(
    (next: boolean) => {
      if (open === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [open, onOpenChange],
  );
  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }, [setOpen]);

  useEffect(() => {
    if (unavailable && open) onOpenChange?.(false);
  }, [unavailable, open, onOpenChange]);

  // Keep the menu inside its modal's DOM/focus scope. The native top layer
  // escapes overflow clipping and transformed sheet containers.
  useLayoutEffect(() => {
    if (isOpen) panelRef.current!.showPopover();
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const anchor = triggerRef.current!;
    const panel = panelRef.current!;
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const result = getMenuPosition(
        rect,
        new DOMRect(0, 0, panel.offsetWidth, panel.scrollHeight + 2),
        placement,
        { width: window.innerWidth, height: window.innerHeight },
      );
      setPosition({
        position: "fixed",
        left: result.left,
        top: result.top,
        maxHeight: result.maxHeight,
      });
      setResolvedPlacement(result.placement);
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(anchor);
    observer.observe(panel);
    const scroll = (event: Event) => {
      if (!panel.contains(event.target as Node)) place();
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", scroll, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [isOpen, placement, width]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current!;
    const trigger = triggerRef.current;
    const items = [
      ...panel.querySelectorAll<HTMLButtonElement>(
        "[data-menu-item]:not(:disabled)",
      ),
    ];
    const initial = firstFocus.current === "last" ? items.at(-1) : items[0];
    (initial ?? panel).focus({ preventScroll: true });
    if (initial)
      panel.scrollTop = firstFocus.current === "last" ? panel.scrollHeight : 0;
    search.current = { text: "", time: 0 };
    firstFocus.current = "first";
    return () => {
      // Also restore focus when a controlled menu closes or its trigger becomes disabled.
      if (panel.contains(document.activeElement) && trigger?.isConnected)
        trigger.focus({ preventScroll: true });
    };
  }, [isOpen]);

  const onOutsidePointer = useEffectEvent((event: PointerEvent) => {
    if (!isOpen) return;
    const target = event.target as Node;
    if (
      !panelRef.current?.contains(target) &&
      !triggerRef.current?.contains(target)
    )
      close();
  });
  const onOutsideFocus = useEffectEvent((event: FocusEvent) => {
    if (!isOpen) return;
    const target = event.target as Node;
    if (
      !panelRef.current?.contains(target) &&
      !triggerRef.current?.contains(target)
    )
      setOpen(false);
  });
  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("pointerdown", onOutsidePointer);
    document.addEventListener("focusin", onOutsideFocus);
    return () => {
      document.removeEventListener("pointerdown", onOutsidePointer);
      document.removeEventListener("focusin", onOutsideFocus);
    };
  }, [isOpen]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === "Tab") {
      // Continue the native tab order from the trigger.
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
      const modal = triggerRef.current?.closest<HTMLElement>(
        'dialog[open], [role="dialog"][aria-modal="true"]',
      );
      if (modal) containTabFocus(event, modal);
      return;
    }
    const items = [
      ...panelRef.current!.querySelectorAll<HTMLButtonElement>(
        "[data-menu-item]:not(:disabled)",
      ),
    ];
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    let next: HTMLButtonElement | undefined;
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const offset = event.key === "ArrowUp" ? -1 : 1;
      next =
        event.key === "Home"
          ? items[0]
          : event.key === "End"
            ? items.at(-1)
            : items[(current + offset + items.length) % items.length];
    } else if (
      event.key.length === 1 &&
      event.key !== " " &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      const text =
        (Date.now() - search.current.time < 700 ? search.current.text : "") +
        event.key.toLocaleLowerCase();
      search.current = { text, time: Date.now() };
      const query = [...text].every((char) => char === text[0])
        ? text[0]
        : text;
      next = [...items.slice(current + 1), ...items.slice(0, current + 1)].find(
        (item) =>
          (item.dataset.textValue ?? item.textContent ?? "")
            .trim()
            .toLocaleLowerCase()
            .startsWith(query),
      );
    }
    if (next) {
      next.focus({ preventScroll: true });
      const panel = panelRef.current!;
      const rect = next.getBoundingClientRect(),
        parent = panel.getBoundingClientRect();
      if (rect.top < parent.top + 6)
        panel.scrollTop -= parent.top + 6 - rect.top;
      else if (rect.bottom > parent.bottom - 6)
        panel.scrollTop += rect.bottom - parent.bottom + 6;
    }
  }
  useImperativeHandle(trigger.props.ref, () => triggerRef.current!, []);
  return (
    <>
      {cloneElement(trigger, {
        ref: triggerRef,
        type: "button",
        disabled: unavailable,
        "aria-haspopup": "menu",
        "aria-expanded": isOpen,
        "aria-controls": isOpen ? id : undefined,
        onClick: (event) => {
          trigger.props.onClick?.(event);
          if (!event.defaultPrevented && !unavailable) {
            firstFocus.current = "first";
            setOpen(!isOpen);
          }
        },
        onKeyDown: (event) => {
          trigger.props.onKeyDown?.(event);
          if (
            event.defaultPrevented ||
            unavailable ||
            !["ArrowDown", "ArrowUp"].includes(event.key)
          )
            return;
          event.preventDefault();
          firstFocus.current = event.key === "ArrowUp" ? "last" : "first";
          setOpen(true);
        },
      })}
      {isOpen && (
        <MenuContext.Provider value={close}>
          <div
            ref={panelRef}
            id={id}
            popover="manual"
            role="menu"
            aria-label={label}
            tabIndex={-1}
            className={["bibbidi-menu", className].filter(Boolean).join(" ")}
            data-placement={resolvedPlacement}
            style={{
              ...style,
              width: Math.max(160, Number.isFinite(width) ? width : 240),
              ...position,
            }}
            onKeyDown={onKeyDown}
          >
            {children}
          </div>
        </MenuContext.Provider>
      )}
    </>
  );
}

type ItemBaseProps = MenuItemProps & {
  checkbox?: boolean;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};
function ItemBase({
  children,
  prefix,
  suffix,
  description,
  textValue,
  tone = "default",
  onSelect,
  closeOnSelect,
  disabled = false,
  className,
  onClick,
  onPointerMove,
  "aria-disabled": ariaDisabled,
  checkbox,
  checked,
  onCheckedChange,
  ...props
}: ItemBaseProps) {
  const menu = useContext(MenuContext);
  const id = useId();
  if (!menu) throw new Error("Menu items must be used inside Menu.");
  const unavailable =
    disabled || ariaDisabled === true || ariaDisabled === "true";
  return (
    <button
      {...props}
      type="button"
      role={checkbox ? "menuitemcheckbox" : "menuitem"}
      aria-checked={checkbox ? checked : undefined}
      aria-disabled={unavailable || undefined}
      aria-labelledby={
        props["aria-label"]
          ? undefined
          : (props["aria-labelledby"] ?? `${id}-label`)
      }
      aria-describedby={
        [description ? `${id}-description` : "", props["aria-describedby"]]
          .filter(Boolean)
          .join(" ") || undefined
      }
      disabled={unavailable}
      tabIndex={-1}
      data-menu-item=""
      data-text-value={
        textValue ?? (typeof children === "string" ? children : undefined)
      }
      data-tone={tone}
      className={["bibbidi-menu-item", className].filter(Boolean).join(" ")}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        if (
          !event.defaultPrevented &&
          !unavailable &&
          event.pointerType === "mouse"
        )
          event.currentTarget.focus({ preventScroll: true });
      }}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || unavailable) return;
        if (closeOnSelect ?? !checkbox) menu();
        if (checkbox) onCheckedChange?.(!checked);
        else onSelect?.();
      }}
    >
      {prefix && (
        <span className="bibbidi-menu-icon" aria-hidden="true">
          {prefix}
        </span>
      )}
      <span className="bibbidi-menu-item-body">
        <span id={`${id}-label`}>{children}</span>
        {description && (
          <span id={`${id}-description`} className="bibbidi-menu-description">
            {description}
          </span>
        )}
      </span>
      {suffix && (
        <span className="bibbidi-menu-suffix" aria-hidden="true">
          {suffix}
        </span>
      )}
      {checkbox && (
        <span className="bibbidi-menu-checkbox" aria-hidden="true">
          {checked && <CheckIcon width={13} height={13} strokeWidth={2.5} />}
        </span>
      )}
    </button>
  );
}
function Item(props: MenuItemProps) {
  return <ItemBase {...props} />;
}
function CheckboxItem({
  checked,
  onCheckedChange,
  ...props
}: MenuCheckboxItemProps) {
  return (
    <ItemBase
      {...props}
      checkbox
      checked={checked}
      onCheckedChange={onCheckedChange}
    />
  );
}
function Label({ className, ...props }: ComponentPropsWithRef<"div">) {
  return (
    <div
      {...props}
      role="presentation"
      className={["bibbidi-menu-label", className].filter(Boolean).join(" ")}
    />
  );
}
function Separator({ className, ...props }: ComponentPropsWithRef<"div">) {
  return (
    <div
      {...props}
      role="separator"
      aria-orientation="horizontal"
      className={["bibbidi-menu-separator", className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
export const Menu = Object.assign(Root, {
  Item,
  CheckboxItem,
  Label,
  Separator,
});
