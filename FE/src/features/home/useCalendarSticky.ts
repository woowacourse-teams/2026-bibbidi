import { useLayoutEffect, useRef } from "react";

/** Keep the whole month visible; a short viewport must still reach every week. */
export function useCalendarSticky() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const calendar = calendarRef.current;
    if (!wrapper || !calendar) return;
    const scrollRoot = wrapper.closest<HTMLElement>(
      "[data-page-scroll-container]",
    );
    let frame = 0;

    const update = () => {
      frame = 0;
      const styles = getComputedStyle(wrapper);
      const enabled =
        styles.getPropertyValue("--calendar-sticky-enabled").trim() === "1";
      delete wrapper.dataset.calendarSticky;
      delete calendar.dataset.density;
      if (!enabled) return;

      const top = Number.parseFloat(styles.top) || 0;
      const bottom =
        Number.parseFloat(styles.getPropertyValue("--calendar-bottom-gap")) ||
        0;
      const viewportHeight = scrollRoot
        ? Math.min(scrollRoot.clientHeight, window.innerHeight)
        : document.documentElement.clientHeight;
      const available = Math.max(0, viewportHeight - top - bottom);
      let height = calendar.getBoundingClientRect().height;
      if (height > available) {
        calendar.dataset.density = "compact";
        height = calendar.getBoundingClientRect().height;
      }
      if (height > 0 && height <= available) {
        wrapper.dataset.calendarSticky = "true";
      }
    };

    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleUpdate);
    observer?.observe(calendar);
    if (wrapper.parentElement) observer?.observe(wrapper.parentElement);
    if (scrollRoot) observer?.observe(scrollRoot);
    // AppLayout measures the header (including its fade) on this scroll root.
    const headerChanges = new MutationObserver(scheduleUpdate);
    if (scrollRoot) {
      headerChanges.observe(scrollRoot, {
        attributes: true,
        attributeFilter: ["style"],
      });
    }
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      headerChanges.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      delete wrapper.dataset.calendarSticky;
      delete calendar.dataset.density;
    };
  }, []);

  return { wrapperRef, calendarRef };
}
