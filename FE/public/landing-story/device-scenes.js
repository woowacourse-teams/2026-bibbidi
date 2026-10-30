(() => {
  "use strict";
  const screens = [...document.querySelectorAll(".device-screen")];
  const fit = (screen) => {
    const canvas = screen.querySelector(".device-screen-ui");
    const scale = screen.clientWidth / canvas.offsetWidth;
    if (Number.isFinite(scale) && scale > 0) {
      canvas.style.setProperty("--device-scale", String(scale));
    }
  };
  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver((entries) =>
      entries.forEach((entry) => fit(entry.target)),
    );
    screens.forEach((screen) => observer.observe(screen));
  } else window.addEventListener("resize", () => screens.forEach(fit));
  screens.forEach(fit);
})();
