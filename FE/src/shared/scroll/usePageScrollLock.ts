import { useEffect } from "react";
import type { RefObject } from "react";
import { lockScroll } from "./lockScroll";

export function usePageScrollLock({
  rootRef,
  active = true,
  lockBody = false,
}: {
  rootRef: RefObject<HTMLElement | null>;
  active?: boolean;
  lockBody?: boolean;
}) {
  useEffect(() => {
    const root = rootRef.current;
    if (!active || !root) return;
    const ownerDocument = root.ownerDocument;
    const scope = root.closest("[data-modal-scope]") ?? ownerDocument;
    const scroll =
      scope instanceof HTMLElement &&
      scope.matches("[data-page-scroll-container]")
        ? scope
        : scope.querySelector<HTMLElement>("[data-page-scroll-container]");
    const release: (() => void)[] = [];
    if (lockBody) release.push(lockScroll(ownerDocument.body));
    if (scroll) release.push(lockScroll(scroll));
    return () => release.reverse().forEach((unlock) => unlock());
  }, [active, lockBody, rootRef]);
}
