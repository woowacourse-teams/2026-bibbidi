import { useLayoutEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { PanelOverlay } from "../../../components/panel-overlay";
import { useExitSnapshot } from "../../../shared/modal/useLayerPresence";
import { usePageScrollContainer } from "../../../shared/scroll/usePageScrollContainer";

/** Connect the service scroll container and close policy to the shared layer. */
export function ChecklistForeground({
  children,
  open = true,
  onExited,
  modal,
  overlay,
  blocked,
  pending,
  titleId,
  onClose,
}: {
  children: ReactNode;
  open?: boolean;
  onExited?: () => void;
  modal: boolean;
  overlay: boolean;
  blocked: boolean;
  pending: boolean;
  titleId: string;
  onClose: () => void;
}) {
  const { ref, environment } = usePageScrollContainer();
  const presentation = useMemo(
    () => ({ modal, overlay, titleId }),
    [modal, overlay, titleId],
  );
  const display = useExitSnapshot(open, presentation) ?? presentation;
  const content = useExitSnapshot(open, children, !blocked);
  useLayoutEffect(() => {
    if (!open && (!display.modal || !environment)) onExited?.();
  }, [open, display.modal, environment, onExited]);
  return (
    <div
      className="checklist-workspace__foreground"
      ref={ref}
      aria-hidden={(open && blocked) || undefined}
      inert={(open && blocked) || undefined}
    >
      {display.modal
        ? environment && (
            <PanelOverlay
              open={open}
              onExited={onExited}
              aria-labelledby={display.titleId}
              placement={display.overlay ? "side" : "fullscreen"}
              scrollContainer={environment.scrollContainer}
              closeOnEscape={!blocked && !pending}
              closeOnDimmerClick={!blocked && !pending}
              aria-hidden={(open && blocked) || undefined}
              inert={(open && blocked) || undefined}
              restoreFocus={!open}
              onClose={onClose}
            >
              {content}
            </PanelOverlay>
          )
        : open
          ? children
          : null}
    </div>
  );
}
