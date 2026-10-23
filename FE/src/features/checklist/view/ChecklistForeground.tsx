import { useEffect, useEffectEvent, useRef } from "react";
import type { ReactNode } from "react";
import {
  containTabFocus,
  focusFirstElement,
} from "../../../shared/focus/containTabFocus";

export function ChecklistForeground({
  children,
  modal,
  overlay,
  blocked,
  onClose,
}: {
  children: ReactNode;
  modal: boolean;
  overlay: boolean;
  blocked: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dismiss = useEffectEvent(() => {
    if (!blocked) onClose();
  });
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (
      blocked ||
      event.defaultPrevented ||
      !ref.current?.contains(event.target as Node)
    )
      return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    } else if (ref.current) containTabFocus(event, ref.current);
  });
  useEffect(() => {
    if (!modal) return;
    const element = ref.current!;
    const previousFocus = document.activeElement;
    const scroll = document.querySelector<HTMLElement>(
      "[data-page-scroll-container]",
    );
    const bodyOverflow = document.body.style.overflow;
    const scrollOverflow = scroll?.style.overflow;
    const chrome = [
      ...document.querySelectorAll<HTMLElement>(
        ".service-layout__header, .service-layout__mobile-dock",
      ),
    ];
    const previousInert = chrome.map((node) => node.hasAttribute("inert"));
    chrome.forEach((node) => node.setAttribute("inert", ""));
    document.body.style.overflow = "hidden";
    if (scroll) scroll.style.overflow = "hidden";
    if (!element.contains(document.activeElement)) focusFirstElement(element);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = bodyOverflow;
      if (scroll) scroll.style.overflow = scrollOverflow ?? "";
      chrome.forEach((node, index) => {
        if (!previousInert[index]) node.removeAttribute("inert");
      });
      if (
        !element.isConnected &&
        previousFocus instanceof HTMLElement &&
        previousFocus.isConnected
      )
        previousFocus.focus({ preventScroll: true });
    };
  }, [modal]);
  return (
    <div
      className="checklist-workspace__foreground-layer"
      data-overlay={overlay || undefined}
      ref={ref}
    >
      {overlay && (
        <button
          className="checklist-workspace__scrim"
          type="button"
          tabIndex={-1}
          aria-label="패널 닫기"
          disabled={blocked}
          onClick={onClose}
        />
      )}
      <div className="checklist-workspace__panel">{children}</div>
    </div>
  );
}
