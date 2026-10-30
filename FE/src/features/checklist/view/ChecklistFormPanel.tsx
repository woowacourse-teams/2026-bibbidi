import { useEffect } from "react";
import type { FormEvent, ReactNode, RefObject } from "react";
import { IconButton } from "../../../components/icon-button";
import { CloseIcon } from "../../../components/icons/ActionIcons";
import { TopNavigation } from "../../../components/top-navigation";
import { Panel } from "../../../components/panel";
import { useIsMobileLayout } from "../../../shared/responsive";
import "./ChecklistFormPanel.css";

type ChecklistFormPanelProps = {
  title: string;
  titleId: string;
  subtitle?: string;
  closeLabel: string;
  modal?: boolean;
  blocked?: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  formRef: RefObject<HTMLFormElement | null>;
  children: ReactNode;
  actions: ReactNode;
} & (
  | { mobileAction?: "back"; backLabel: string }
  | { mobileAction: "close"; backLabel?: never }
);

export function ChecklistFormPanel({
  title,
  titleId,
  subtitle,
  backLabel,
  closeLabel,
  mobileAction,
  modal = false,
  blocked = false,
  isSubmitting,
  onClose,
  onSubmit,
  formRef,
  children,
  actions,
}: ChecklistFormPanelProps) {
  const mobile = useIsMobileLayout();
  useEffect(() => {
    if (modal) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const form = formRef.current;
      if (
        !form?.contains(event.target as Node) ||
        blocked ||
        event.defaultPrevented ||
        event.isComposing
      )
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!isSubmitting) onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [formRef, modal, blocked, isSubmitting, onClose]);
  const Container = modal ? "div" : "aside";
  return (
    <Container
      className="checklist-form-panel"
      aria-labelledby={titleId}
      aria-hidden={blocked || undefined}
      inert={blocked || undefined}
    >
      <form noValidate ref={formRef} onSubmit={onSubmit}>
        <Panel
          header={
            mobile ? (
              <TopNavigation
                title={<span id={titleId}>{title}</span>}
                subtitle={subtitle}
                headingLevel={2}
                sticky={false}
                safeArea
                divider
                leading={
                  mobileAction === "close" ? (
                    <TopNavigation.CloseButton
                      aria-label={closeLabel}
                      disabled={isSubmitting}
                      onClick={onClose}
                    />
                  ) : (
                    <TopNavigation.BackButton
                      aria-label={backLabel}
                      disabled={isSubmitting}
                      onClick={onClose}
                    />
                  )
                }
              />
            ) : (
              <Panel.Header
                title={title}
                titleId={titleId}
                subtitle={subtitle}
                actions={
                  <IconButton
                    aria-label={closeLabel}
                    icon={<CloseIcon />}
                    disabled={isSubmitting}
                    onClick={onClose}
                  />
                }
              />
            )
          }
          footer={actions}
        >
          <div className="checklist-form-panel__fields">{children}</div>
        </Panel>
      </form>
    </Container>
  );
}
