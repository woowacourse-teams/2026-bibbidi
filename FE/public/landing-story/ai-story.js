(() => {
  "use strict";
  const root = document.querySelector("[data-stream-demo]");
  if (!root) return;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const durations = [900, 1100, 1000, 1000, 0];
  let step = motion.matches ? 4 : 0;
  let visible = false;
  let timer = null;
  let remaining = durations[step];
  let startedAt = 0;

  function render() {
    root.dataset.streamStep = String(step);
    root.querySelectorAll("[data-answer-chunk]").forEach((chunk, index) => {
      chunk.hidden = step < index + 1;
    });
    root.querySelector("[data-stream-waiting]").hidden = step > 0;
    root.querySelector("[data-stream-card]").hidden = step < 4;
    root.querySelector(".sse-live-label").textContent =
      step === 4
        ? "전달 완료"
        : step
          ? "답변을 이어 보내는 중"
          : "답변을 만드는 중";
    root.querySelectorAll("[data-stream-phase]").forEach((phase) => {
      phase.classList.toggle(
        "is-delivered",
        step >= Number(phase.dataset.streamPhase),
      );
    });
  }

  function stop() {
    if (timer === null) return;
    window.clearTimeout(timer);
    timer = null;
    remaining = Math.max(0, remaining - (performance.now() - startedAt));
  }

  function schedule() {
    if (timer !== null || !visible || document.hidden || step === 4) return;
    startedAt = performance.now();
    timer = window.setTimeout(() => {
      timer = null;
      step += 1;
      remaining = durations[step];
      render();
      schedule();
    }, remaining);
  }

  root.querySelector("[data-stream-replay]").addEventListener("click", () => {
    stop();
    step = motion.matches ? 4 : 0;
    remaining = durations[step];
    render();
    schedule();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    schedule();
  });
  motion.addEventListener("change", (event) => {
    if (!event.matches) return;
    stop();
    step = 4;
    remaining = 0;
    render();
  });
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        if (!visible) stop();
        schedule();
      },
      { threshold: 0.3 },
    );
    observer.observe(root);
  } else step = 4;
  render();
})();
