import { useId, useRef } from "react";
import type {
  ComponentPropsWithoutRef,
  CSSProperties,
  ReactNode,
  RefObject,
} from "react";
import { Button, type ButtonProps } from "../button";
import { Checkbox } from "../checkbox";
import { containTabFocus } from "../../shared/focus/containTabFocus";
import { useBottomSheetLifecycle } from "./useBottomSheetLifecycle";
import { useBottomSheetDrag } from "./useBottomSheetDrag";
import "./BottomSheet.css";

export type BottomSheetProps = Omit<
  ComponentPropsWithoutRef<"dialog">,
  "open" | "onClose" | "onCancel" | "children"
> & {
  open: boolean;
  onClose: () => void;
  header?: ReactNode;
  headerDescription?: ReactNode;
  headerActions?: ReactNode;
  scrollContainer?: HTMLElement | null;
  returnFocusRef?: RefObject<HTMLElement | null>;
  cta?: ReactNode;
  children?: ReactNode;
  closeOnDimmerClick?: boolean;
  /** Compatibility alias; closeOnDimmerClick takes precedence. */
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  draggable?: boolean;
  disableChildrenDragging?: boolean;
  hasTextField?: boolean;
  maxHeight?: number;
  animation?: boolean;
  onEntered?: () => void;
  onExited?: () => void;
};

function Root({
  open,
  onClose,
  header,
  headerDescription,
  headerActions,
  scrollContainer,
  returnFocusRef,
  cta,
  children,
  closeOnDimmerClick,
  closeOnBackdrop = true,
  closeOnEscape = true,
  draggable = true,
  disableChildrenDragging = false,
  hasTextField = false,
  maxHeight,
  animation = true,
  onEntered,
  onExited,
  className,
  style,
  "aria-label": ariaLabel,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onKeyDown,
  ...props
}: BottomSheetProps) {
  const { dialogRef, panelRef, titleId, descriptionId } =
    useBottomSheetLifecycle({
      open,
      hasTextField,
      scrollContainer,
      returnFocusRef,
      onEntered,
      onExited,
    });
  const drag = useBottomSheetDrag({
    panelRef,
    enabled: open && draggable,
    disableChildrenDragging,
    onDismiss: onClose,
  });
  const backdropPress = useRef(false);
  const dismissOnDimmer = closeOnDimmerClick ?? closeOnBackdrop;
  return (
    <dialog
      tabIndex={-1}
      {...props}
      ref={dialogRef}
      className={["bibbidi-bottom-sheet", className].filter(Boolean).join(" ")}
      data-animation={animation || undefined}
      data-dragging={drag.offset > 0 || undefined}
      style={
        {
          ...style,
          "--bottom-sheet-drag-offset": `${drag.offset}px`,
          "--bottom-sheet-max-height":
            maxHeight !== undefined && Number.isFinite(maxHeight)
              ? `${Math.max(0, maxHeight)}px`
              : undefined,
        } as CSSProperties
      }
      aria-modal="true"
      aria-label={
        ariaLabel ?? (!header && !labelledBy ? "상세 내용" : undefined)
      }
      aria-labelledby={labelledBy ?? (header ? titleId : undefined)}
      aria-describedby={
        describedBy ?? (headerDescription ? descriptionId : undefined)
      }
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || event.nativeEvent.isComposing) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (closeOnEscape && open) onClose();
        } else if (event.key === "Tab") {
          containTabFocus(event, event.currentTarget);
          event.stopPropagation();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (closeOnEscape && open) onClose();
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        drag.onPointerDown(event);
        backdropPress.current =
          !event.defaultPrevented && event.target === event.currentTarget;
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        drag.onPointerMove(event);
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event);
        drag.onPointerCancel(event);
        backdropPress.current = false;
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        drag.onPointerUp(event);
        if (
          !event.defaultPrevented &&
          backdropPress.current &&
          event.target === event.currentTarget &&
          dismissOnDimmer &&
          open
        )
          onClose();
        backdropPress.current = false;
      }}
    >
      <div
        ref={panelRef}
        className="bibbidi-bottom-sheet-panel"
        inert={!open || undefined}
      >
        {draggable && (
          <button
            type="button"
            className="bibbidi-bottom-sheet-handle"
            aria-label="아래로 밀어 닫기"
            disabled={!open}
            onClick={(event) => {
              if (event.detail === 0) onClose();
            }}
          >
            <span aria-hidden="true" />
          </button>
        )}
        <div className="bibbidi-bottom-sheet-top">
          <div className="bibbidi-bottom-sheet-heading">
            {header && <div id={titleId}>{header}</div>}
            {headerDescription && (
              <div id={descriptionId}>{headerDescription}</div>
            )}
          </div>
          {headerActions && (
            <div className="bibbidi-bottom-sheet-header-actions">
              {headerActions}
            </div>
          )}
        </div>
        <div className="bibbidi-bottom-sheet-body">{children}</div>
        {cta && <div className="bibbidi-bottom-sheet-footer">{cta}</div>}
      </div>
    </dialog>
  );
}
function Header({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"h2">) {
  return (
    <h2
      {...props}
      className={["bibbidi-bottom-sheet-title", className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </h2>
  );
}
function HeaderDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<"p">) {
  return (
    <p
      {...props}
      className={["bibbidi-bottom-sheet-description", className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
function CTA(props: ButtonProps) {
  return <Button {...props} display="block" />;
}
export type BottomSheetDoubleCTAProps = {
  leftButton: ReactNode;
  rightButton: ReactNode;
};
function DoubleCTA({ leftButton, rightButton }: BottomSheetDoubleCTAProps) {
  return (
    <div className="bibbidi-bottom-sheet-double-cta">
      <div>{leftButton}</div>
      <div>{rightButton}</div>
    </div>
  );
}
export type BottomSheetSelectProps = {
  value?: string;
  onChange: (value: string) => void;
  options: { name: string; value: string; disabled?: boolean }[];
  "aria-label": string;
};
function Select({
  value,
  onChange,
  options,
  "aria-label": label,
}: BottomSheetSelectProps) {
  const name = useId();
  return (
    <div
      className="bibbidi-bottom-sheet-select"
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className="bibbidi-bottom-sheet-option"
          data-disabled={option.disabled || undefined}
        >
          <span>{option.name}</span>
          <Checkbox
            inputType="radio"
            size={20}
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled}
            onChange={() => onChange(option.value)}
          />
        </label>
      ))}
    </div>
  );
}
export const BottomSheet = Object.assign(Root, {
  Header,
  HeaderDescription,
  CTA,
  DoubleCTA,
  Select,
});
