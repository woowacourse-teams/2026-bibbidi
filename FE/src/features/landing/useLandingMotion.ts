import { useEffect, useRef, useState } from "react";

import {
  MOBILE_LAYOUT_MEDIA_QUERY,
  useMediaQuery,
} from "../../shared/responsive";

export const LANDING_REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function useLandingMotion() {
  const rootRef = useRef<HTMLDivElement>(null);
  const featureRef = useRef<HTMLElement>(null);
  const targetScrollRef = useRef<number | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useMediaQuery(LANDING_REDUCED_MOTION_QUERY);
  const motionDisabled = paused || reducedMotion;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const revealElements = root.querySelectorAll<HTMLElement>("[data-reveal]");
    if (typeof IntersectionObserver === "undefined") {
      revealElements.forEach((element) => element.classList.add("seen"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("seen");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    revealElements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const feature = featureRef.current;
    if (!root || !feature || motionDisabled) return;

    const hero = root.querySelector<HTMLElement>(".landing-hero");
    const heroPhone = root.querySelector<HTMLElement>(".landing-hero-phone");
    const leftCard = root.querySelector<HTMLElement>(".landing-float-left");
    const rightCard = root.querySelector<HTMLElement>(".landing-float-right");
    const intro = root.querySelector<HTMLElement>(".landing-intro");
    const introLines = intro?.querySelectorAll("h2 span");
    let frame = 0;

    const render = () => {
      frame = 0;
      const top = window.matchMedia?.(MOBILE_LAYOUT_MEDIA_QUERY).matches
        ? 64
        : 76;
      const travel = feature.offsetHeight - (window.innerHeight - top);
      if (travel <= 0) return;
      const progress = clamp(
        (top - feature.getBoundingClientRect().top) / Math.max(1, travel),
      );
      root.style.setProperty("--progress", String(progress));

      const target = targetScrollRef.current;
      if (target !== null && Math.abs(window.scrollY - target) < 3) {
        targetScrollRef.current = null;
      }
      if (targetScrollRef.current === null) {
        setActiveStep(Math.min(2, Math.floor(progress * 3)));
      }

      if (hero) {
        const position = clamp(
          -hero.getBoundingClientRect().top / Math.max(1, hero.offsetHeight),
        );
        if (heroPhone)
          heroPhone.style.transform = `rotate(${-8 + position * 12}deg) translateY(${-position * 36}px)`;
        if (leftCard)
          leftCard.style.transform = `rotate(${-4 + position * 5}deg) translateY(${-position * 85}px)`;
        if (rightCard)
          rightCard.style.transform = `rotate(${5 - position * 8}deg) translateY(${-position * 50}px)`;
      }

      if (intro && introLines) {
        const progress = clamp(
          (window.innerHeight * 0.78 - intro.getBoundingClientRect().top) /
            Math.max(1, intro.offsetHeight * 0.9),
        );
        introLines.forEach((line, index) =>
          line.classList.toggle("lit", progress > (index + 1) * 0.18),
        );
      }
    };

    const requestRender = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    const cancelTarget = () => {
      targetScrollRef.current = null;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        [
          "ArrowDown",
          "ArrowUp",
          "PageDown",
          "PageUp",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      ) {
        cancelTarget();
      }
    };

    requestRender();
    window.addEventListener("scroll", requestRender, { passive: true });
    window.addEventListener("resize", requestRender);
    window.addEventListener("wheel", cancelTarget, { passive: true });
    window.addEventListener("touchstart", cancelTarget, { passive: true });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      targetScrollRef.current = null;
      window.removeEventListener("scroll", requestRender);
      window.removeEventListener("resize", requestRender);
      window.removeEventListener("wheel", cancelTarget);
      window.removeEventListener("touchstart", cancelTarget);
      window.removeEventListener("keydown", onKeyDown);
      [heroPhone, leftCard, rightCard].forEach((element) =>
        element?.style.removeProperty("transform"),
      );
    };
  }, [motionDisabled]);

  function selectStep(index: number) {
    setActiveStep(index);
    const feature = featureRef.current;
    if (!feature || motionDisabled) return;

    const top = window.matchMedia?.(MOBILE_LAYOUT_MEDIA_QUERY).matches
      ? 64
      : 76;
    const travel = feature.offsetHeight - (window.innerHeight - top);
    const target =
      feature.getBoundingClientRect().top +
      window.scrollY -
      top +
      (travel * (index + 0.12)) / 3;
    targetScrollRef.current = target;
    window.scrollTo({ top: target, behavior: "smooth" });
  }

  return {
    rootRef,
    featureRef,
    activeStep,
    motionDisabled,
    reducedMotion,
    selectStep,
    toggleMotion: () => setPaused((value) => !value),
  };
}
