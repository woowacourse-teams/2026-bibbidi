import {
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type {
  ComponentPropsWithRef,
  CSSProperties,
  ReactElement,
  ReactNode,
  RefObject,
} from "react";
import { CloseIcon } from "../icons/ActionIcons";
import { Button, type ButtonProps } from "../button";
import { IconButton } from "../icon-button";
import { getPopoverPosition, type PopoverPlacement } from "./placement";
import "./Popover.css";

export type PopoverProps = {
  /** A native button or a component forwarding button props and ref. */
  trigger: ReactElement<ComponentPropsWithRef<"button">>;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: PopoverPlacement;
  width?: number;
  offset?: number;
  disabled?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
  style?: CSSProperties;
};
export type PopoverCloseProps = Omit<ButtonProps, "type">;
const CloseContext = createContext<(() => void) | null>(null);

function Root({
  trigger,
  title,
  description,
  children,
  footer,
  open,
  defaultOpen = false,
  onOpenChange,
  placement = "bottom",
  width = 320,
  offset = 8,
  disabled = false,
  initialFocusRef,
  className,
  style,
}: PopoverProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const unavailable =
    disabled ||
    trigger.props.disabled ||
    trigger.props["aria-disabled"] === true ||
    trigger.props["aria-disabled"] === "true";
  const requestedOpen = open ?? internalOpen;
  const isOpen = requestedOpen && !unavailable;
  if (unavailable && internalOpen) setInternalOpen(false);
  const [position, setPosition] = useState<CSSProperties>({ left: 8, top: 8 });
  const [resolvedPlacement, setResolvedPlacement] = useState(placement);
  const setOpen = useCallback(
    (next: boolean) => {
      if (next === requestedOpen) return;
      if (open === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [open, requestedOpen, onOpenChange],
  );
  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }, [setOpen]);

  useEffect(() => {
    if (unavailable && open) onOpenChange?.(false);
  }, [unavailable, open, onOpenChange]);

  useLayoutEffect(() => {
    const panel = panelRef.current!;
    if (isOpen) {
      if (!panel.matches(":popover-open")) {
        panel.showPopover();
        const initial = initialFocusRef?.current;
        (initial && panel.contains(initial) ? initial : panel).focus({
          preventScroll: true,
        });
      }
    } else if (panel.matches(":popover-open")) {
      const restore = panel.contains(document.activeElement);
      panel.hidePopover();
      if (restore) triggerRef.current?.focus({ preventScroll: true });
    }
  }, [isOpen, initialFocusRef]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const anchor = triggerRef.current!;
    const panel = panelRef.current!;
    const place = () => {
      const result = getPopoverPosition(
        anchor.getBoundingClientRect(),
        { width: panel.offsetWidth, height: panel.scrollHeight + 2 },
        placement,
        { width: window.innerWidth, height: window.innerHeight },
        offset,
      );
      setPosition({
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
  }, [isOpen, placement, offset, width]);

  useEffect(() => {
    if (!isOpen) return;
    const outsideFocus = (event: FocusEvent) => {
      const target = event.target as Node;
      if (
        !panelRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      )
        setOpen(false);
    };
    document.addEventListener("focusin", outsideFocus);
    return () => document.removeEventListener("focusin", outsideFocus);
  }, [isOpen, setOpen]);

  useImperativeHandle(trigger.props.ref, () => triggerRef.current!, []);

  return (
    <>
      {cloneElement(trigger, {
        ref: triggerRef,
        type: "button",
        disabled: unavailable,
        popoverTarget: id,
        popoverTargetAction: "toggle",
        "aria-haspopup": "dialog",
        "aria-expanded": isOpen,
        "aria-controls": id,
        onClick: (event) => {
          trigger.props.onClick?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault(); // React owns visibility; suppress the native target's second toggle.
          if (!unavailable) setOpen(!isOpen);
        },
      })}
      <CloseContext.Provider value={close}>
        {/* The focusable dialog handles Escape from its interactive contents. */}
        {/* eslint-disable-next-line jsx-a11y-x/no-noninteractive-element-interactions */}
        <div
          ref={panelRef}
          id={id}
          popover="auto"
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${id}-title`}
          aria-describedby={description ? `${id}-description` : undefined}
          tabIndex={-1}
          className={["bibbidi-popover", className].filter(Boolean).join(" ")}
          data-placement={resolvedPlacement}
          style={{
            ...style,
            width: Math.max(200, Number.isFinite(width) ? width : 320),
            ...position,
          }}
          onToggle={(event) => {
            if (event.target !== event.currentTarget) return;
            // Light dismiss, Escape, or another auto popover can close the native layer.
            setOpen(event.currentTarget.matches(":popover-open"));
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Escape" &&
              !event.defaultPrevented &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
          }}
        >
          <div className="bibbidi-popover-header">
            <h2 id={`${id}-title`} className="bibbidi-popover-title">
              {title}
            </h2>
            <IconButton
              className="bibbidi-popover-dismiss"
              icon={<CloseIcon />}
              iconSize={18}
              aria-label={`${title} 닫기`}
              onClick={close}
            />
          </div>
          {description && (
            <div
              id={`${id}-description`}
              className="bibbidi-popover-description"
            >
              {description}
            </div>
          )}
          {children != null && (
            <div className="bibbidi-popover-body">{children}</div>
          )}
          {footer != null && (
            <div className="bibbidi-popover-footer">{footer}</div>
          )}
        </div>
      </CloseContext.Provider>
    </>
  );
}

function Close({ onClick, ...props }: PopoverCloseProps) {
  const close = useContext(CloseContext);
  if (!close) throw new Error("Popover.Close must be used inside Popover.");
  return (
    <Button
      {...props}
      type="button"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) close();
      }}
    />
  );
}

export const Popover = Object.assign(Root, { Close });
