import { useEffect } from "react";
import type { FormEvent, ReactNode, RefObject } from "react";
import { IconButton } from "../../../components/icon-button";
import { CloseIcon } from "../../../components/icons/ActionIcons";
import { ChevronLeft } from "../../../components/icons/Chevron";
import { containTabFocus } from "../../../shared/focus/containTabFocus";
import { useIsMobileLayout } from "../../../shared/responsive";
import "./ChecklistFormPanel.css";

export function ChecklistFormPanel({
  title,
  titleId,
  subtitle,
  backLabel,
  closeLabel,
  modal = false,
  blocked = false,
  isSubmitting,
  onClose,
  onSubmit,
  formRef,
  children,
  actions,
}: {
  title: string;
  titleId: string;
  subtitle?: string;
  backLabel: string;
  closeLabel: string;
  modal?: boolean;
  blocked?: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  formRef: RefObject<HTMLFormElement | null>;
  children: ReactNode;
  actions: ReactNode;
}) {
  const mobile = useIsMobileLayout();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const form = formRef.current;
      if (
        !form ||
        !form.contains(event.target as Node) ||
        event.defaultPrevented ||
        event.isComposing ||
        blocked
      )
        return;
      if (mobile && !modal) containTabFocus(event, form);
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!isSubmitting) onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [formRef, mobile, modal, blocked, isSubmitting, onClose]);
  return (
    <aside
      className="checklist-form-panel"
      data-mobile={mobile || undefined}
      aria-labelledby={titleId}
      role={mobile || modal ? "dialog" : "complementary"}
      aria-modal={mobile || modal ? true : undefined}
      aria-hidden={blocked || undefined}
      inert={blocked || undefined}
    >
      <form noValidate ref={formRef} onSubmit={onSubmit}>
        <header className="checklist-form-panel__header">
          {mobile && (
            <IconButton
              aria-label={backLabel}
              icon={<ChevronLeft />}
              disabled={isSubmitting}
              onClick={onClose}
            />
          )}
          <div className="checklist-form-panel__heading">
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {mobile ? (
            <span className="checklist-form-panel__spacer" aria-hidden="true" />
          ) : (
            <IconButton
              aria-label={closeLabel}
              icon={<CloseIcon />}
              disabled={isSubmitting}
              onClick={onClose}
            />
          )}
        </header>
        <div className="checklist-form-panel__body">{children}</div>
        <footer className="checklist-form-panel__footer">{actions}</footer>
      </form>
    </aside>
  );
}
