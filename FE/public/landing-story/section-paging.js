(() => {
  "use strict";
  const sections = [...document.querySelectorAll("main > section")];
  if (!sections.length) return;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let gestureUsed = false;
  let settling = false;
  let quietTimer = null;
  let settleTimer = null;
  let accumulated = 0;
  let gestureDirection = 0;

  function stops() {
    const header = document
      .querySelector(".site-header")
      .getBoundingClientRect().bottom;
    const available = window.innerHeight - header - 32;
    const maxY = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight,
    );
    const points = [];
    for (const section of sections) {
      const rect = section.getBoundingClientRect();
      const stage = section
        .querySelector(".feature-layout")
        ?.getBoundingClientRect();
      if (stage?.height && stage.height <= available) {
        points.push(
          window.scrollY +
            stage.top -
            header -
            16 -
            (available - stage.height) / 2,
        );
        continue;
      }
      const start = window.scrollY + rect.top - header;
      const end = window.scrollY + rect.bottom - window.innerHeight + 16;
      points.push(start);
      // Short viewports still get every part of a section before advancing to the next one.
      const step = Math.max(160, available - 24);
      for (let y = start + step; y < end - 40; y += step) points.push(y);
      if (end > start + 40) points.push(end);
    }
    points.push(maxY);
    return points
      .map((y) => Math.max(0, Math.min(maxY, y)))
      .sort((a, b) => a - b)
      .filter((y, i, all) => !i || y - all[i - 1] > 4);
  }

  function move(direction) {
    const points = stops();
    const current = window.scrollY;
    let target =
      direction > 0
        ? points.find((y) => y > current + 48)
        : [...points].reverse().find((y) => y < current - 48);
    if (target === undefined) return;
    const overview = document.querySelector('[data-player="overview"]');
    if (direction > 0 && overview?.dataset.firstPlaybackComplete === "false") {
      const stage = overview.closest(".feature-layout").getBoundingClientRect();
      const section = overview.closest("section").getBoundingClientRect();
      const header = document
        .querySelector(".site-header")
        .getBoundingClientRect().bottom;
      const available = window.innerHeight - header - 32;
      if (stage.height) {
        const gate =
          stage.height <= available
            ? current + stage.top - header - 16 - (available - stage.height) / 2
            : current + section.bottom - window.innerHeight + 16;
        if (section.bottom > header) {
          if (current >= gate - 8) return;
          target = Math.min(target, gate);
        }
      }
    }
    gestureUsed = true;
    keepGesture();
    settling = true;
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(
      () => {
        settling = false;
      },
      motion.matches ? 0 : 750,
    );
    window.scrollTo({
      top: target,
      behavior: motion.matches ? "instant" : "smooth",
    });
  }

  function keepGesture() {
    window.clearTimeout(quietTimer);
    quietTimer = window.setTimeout(() => {
      gestureUsed = false;
      accumulated = 0;
      gestureDirection = 0;
    }, 260);
  }

  function innerScroll(target, direction) {
    for (let el = target; el && el !== document.body; el = el.parentElement) {
      if (!(el instanceof Element)) continue;
      if (!/(auto|scroll)/.test(getComputedStyle(el).overflowY)) continue;
      if (direction > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1)
        return true;
      if (direction < 0 && el.scrollTop > 0) return true;
    }
    return false;
  }

  window.addEventListener(
    "wheel",
    (event) => {
      if (
        event.ctrlKey ||
        !event.deltaY ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
      )
        return;
      const direction = Math.sign(event.deltaY);
      if (direction < 0 && gestureDirection > 0) {
        gestureUsed = false;
        settling = false;
        accumulated = 0;
      }
      gestureDirection = direction;
      keepGesture();
      if (
        event.defaultPrevented ||
        document.documentElement.classList.contains("demo-scroll-held")
      ) {
        gestureUsed = true;
        return;
      }
      if (innerScroll(event.target, direction)) return;
      event.preventDefault();
      if (settling || gestureUsed) {
        gestureUsed = true;
        return;
      }
      const delta =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? window.innerHeight
            : 1);
      accumulated =
        Math.sign(accumulated) === direction ? accumulated + delta : delta;
      if (Math.abs(accumulated) >= 32) move(direction);
    },
    { passive: false },
  );

  let touchStart = null;
  let touchBlocked = false;
  window.addEventListener(
    "touchstart",
    (event) => {
      touchStart = event.touches.length === 1 ? event.touches[0].clientY : null;
      touchBlocked = false;
    },
    { passive: true },
  );
  window.addEventListener(
    "touchmove",
    (event) => {
      if (touchStart === null || event.touches.length !== 1) return;
      if (
        event.defaultPrevented ||
        document.documentElement.classList.contains("demo-scroll-held")
      ) {
        touchBlocked = true;
        return;
      }
      const delta = touchStart - event.touches[0].clientY;
      if (innerScroll(event.target, Math.sign(delta))) {
        touchBlocked = true;
        return;
      }
      event.preventDefault();
    },
    { passive: false },
  );
  window.addEventListener(
    "touchend",
    (event) => {
      if (
        touchStart !== null &&
        !touchBlocked &&
        !settling &&
        event.changedTouches.length
      ) {
        const delta = touchStart - event.changedTouches[0].clientY;
        if (Math.abs(delta) >= 45) move(Math.sign(delta));
      }
      touchStart = null;
    },
    { passive: true },
  );
  window.addEventListener(
    "touchcancel",
    () => {
      touchStart = null;
    },
    { passive: true },
  );

  document.addEventListener("keydown", (event) => {
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.target.closest?.(
        "button, a, input, textarea, select, summary, [contenteditable]",
      )
    )
      return;
    const direction =
      ["ArrowDown", "PageDown"].includes(event.key) ||
      (event.key === " " && !event.shiftKey)
        ? 1
        : ["ArrowUp", "PageUp"].includes(event.key) ||
            (event.key === " " && event.shiftKey)
          ? -1
          : 0;
    if (!direction || innerScroll(event.target, direction)) return;
    event.preventDefault();
    if (!settling && !event.repeat) move(direction);
  });
})();
