import { cloneElement, useEffect, useId } from "react";
import type {
  ComponentPropsWithRef,
  ReactElement,
  ReactNode,
  RefObject,
} from "react";
import { BottomSheet } from "../bottom-sheet";
import { IconButton } from "../icon-button";
import { CloseIcon } from "../icons/ActionIcons";
import { Popover, type PopoverPlacement } from "../popover";
import { useIsMobileLayout } from "../../shared/responsive";

interface PickerLayerProps {
  trigger: ReactElement<ComponentPropsWithRef<"button">>;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
  footer: (mobile: boolean) => ReactNode;
  disabled?: boolean;
  placement?: PopoverPlacement;
  onExited?: () => void;
  showDismiss?: boolean;
  disableChildrenDragging?: boolean;
}

/** Shared layer mechanics; callers own draft values and confirmation policy. */
export function PickerLayer({
  trigger,
  title,
  open,
  onOpenChange,
  returnFocusRef,
  initialFocusRef,
  children,
  footer,
  disabled,
  placement = "bottom-start",
  onExited,
  showDismiss = false,
  disableChildrenDragging = false,
}: PickerLayerProps) {
  const mobile = useIsMobileLayout();
  const sheetId = useId();
  useEffect(() => {
    if (!mobile && !open) onExited?.();
  }, [mobile, open, onExited]);

  if (!mobile)
    return (
      <Popover
        trigger={trigger}
        title={title}
        open={open}
        onOpenChange={onOpenChange}
        placement={placement}
        width={360}
        initialFocusRef={initialFocusRef}
        disabled={disabled}
        footer={footer(false)}
      >
        {children}
      </Popover>
    );

  return (
    <>
      {cloneElement(trigger, {
        "aria-haspopup": "dialog",
        "aria-expanded": open,
        "aria-controls": open ? sheetId : undefined,
        onClick: (event) => {
          trigger.props.onClick?.(event);
          if (!event.defaultPrevented && !disabled) onOpenChange(!open);
        },
      })}
      <BottomSheet
        id={sheetId}
        open={open}
        onClose={() => onOpenChange(false)}
        onExited={onExited}
        returnFocusRef={returnFocusRef}
        onEntered={() =>
          initialFocusRef?.current?.focus({ preventScroll: true })
        }
        header={<BottomSheet.Header>{title}</BottomSheet.Header>}
        headerActions={
          showDismiss ? (
            <IconButton
              aria-label={`${title} 닫기`}
              icon={<CloseIcon />}
              iconSize={20}
              onClick={() => onOpenChange(false)}
            />
          ) : undefined
        }
        cta={footer(true)}
        disableChildrenDragging={disableChildrenDragging}
      >
        {children}
      </BottomSheet>
    </>
  );
}
