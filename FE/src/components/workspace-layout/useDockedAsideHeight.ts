import { useLayoutEffect } from "react";
import type { RefObject } from "react";

/** Size a sticky aside from its actual start, including navigation above it. */
export function useDockedAsideHeight(
  ref: RefObject<HTMLDivElement | null>,
  docked: boolean,
) {
  useLayoutEffect(() => {
    const aside = ref.current;
    if (!aside || !docked) return;
    const scroll = aside.closest<HTMLElement>("[data-page-scroll-container]");
    const update = () => {
      const styles = getComputedStyle(aside);
      const gap =
        Number.parseFloat(styles.getPropertyValue("--layout-gutter-desktop")) ||
        0;
      const top = Math.max(
        aside.getBoundingClientRect().top,
        (scroll?.getBoundingClientRect().top ?? 0) + gap,
      );
      aside.style.setProperty(
        "--workspace-aside-height",
        `${Math.max(0, window.innerHeight - top - gap)}px`,
      );
    };
    update();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(aside);
    if (aside.parentElement) observer?.observe(aside.parentElement);
    window.addEventListener("resize", update);
    scroll?.addEventListener("scroll", update, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
      scroll?.removeEventListener("scroll", update);
      aside.style.removeProperty("--workspace-aside-height");
    };
  }, [ref, docked]);
}
