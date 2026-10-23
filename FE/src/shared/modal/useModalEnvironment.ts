import { useEffect, useEffectEvent } from "react";
import type { RefObject } from "react";
import { containTabFocus, focusFirstElement } from "../focus/containTabFocus";

// Locks are shared by sheets and foreground panels so overlapping lifetimes
// cannot restore scrolling or background interaction before the last owner exits.
const scrollLocks = new WeakMap<
  HTMLElement,
  { count: number; previous: string }
>();
const inertLocks = new WeakMap<
  HTMLElement,
  { count: number; previous: boolean }
>();

function lockScroll(element: HTMLElement) {
  const lock = scrollLocks.get(element) ?? {
    count: 0,
    previous: element.style.overflow,
  };
  scrollLocks.set(element, lock);
  lock.count++;
  element.style.overflow = "hidden";
  return () => {
    if (--lock.count === 0) {
      element.style.overflow = lock.previous;
      scrollLocks.delete(element);
    }
  };
}

function lockInert(element: HTMLElement) {
  const lock = inertLocks.get(element) ?? {
    count: 0,
    previous: element.hasAttribute("inert"),
  };
  inertLocks.set(element, lock);
  lock.count++;
  element.setAttribute("inert", "");
  return () => {
    if (--lock.count === 0) {
      if (!lock.previous) element.removeAttribute("inert");
      inertLocks.delete(element);
    }
  };
}

export function useModalEnvironment({
  active = true,
  rootRef,
  blocked = false,
  onEscape,
  initialFocusRef,
  returnFocusRef,
  inertBackground = false,
  restoreOnlyOnUnmount = false,
}: {
  active?: boolean;
  rootRef: RefObject<HTMLElement | null>;
  blocked?: boolean;
  onEscape?: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  inertBackground?: boolean;
  restoreOnlyOnUnmount?: boolean;
}) {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const root = rootRef.current;
    if (
      !root ||
      blocked ||
      event.defaultPrevented ||
      event.isComposing ||
      !root.contains(event.target as Node)
    )
      return;
    if (event.key === "Escape" && onEscape) {
      event.preventDefault();
      event.stopPropagation();
      onEscape();
    } else containTabFocus(event, root);
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!active || !root) return;
    const previous = returnFocusRef?.current ?? document.activeElement;
    const scope = root.closest("[data-modal-scope]") ?? document;
    const scroll = scope.querySelector<HTMLElement>(
      "[data-page-scroll-container]",
    );
    const release = [lockScroll(document.body)];
    if (scroll) release.push(lockScroll(scroll));
    if (inertBackground) {
      scope
        .querySelectorAll<HTMLElement>("[data-modal-background]")
        .forEach((element) => release.push(lockInert(element)));
    }
    if (initialFocusRef?.current)
      initialFocusRef.current.focus({ preventScroll: true });
    else if (!root.contains(document.activeElement)) focusFirstElement(root);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      release.reverse().forEach((unlock) => unlock());
      if (
        (!restoreOnlyOnUnmount || !root.isConnected) &&
        previous instanceof HTMLElement &&
        previous.isConnected
      )
        previous.focus({ preventScroll: true });
    };
  }, [
    active,
    rootRef,
    initialFocusRef,
    returnFocusRef,
    inertBackground,
    restoreOnlyOnUnmount,
  ]);
}
