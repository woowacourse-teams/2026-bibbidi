/** jsdom does not implement native Popover visibility or light dismissal. */
export function installPopoverMock() {
  const prototype = HTMLElement.prototype;
  const descriptors = Object.getOwnPropertyDescriptors(prototype);
  const originalMatches = prototype.matches;
  const style = document.createElement("style");
  style.textContent =
    '[popover="auto"]:not([data-test-popover-open]), [popover="manual"]:is([role="listbox"], [role="menu"]):not([data-test-popover-open]) { display: none; } [data-test-popover-open] { display: block; }';
  document.head.append(style);

  function toggle(element: HTMLElement, open: boolean) {
    const wasOpen = element.hasAttribute("data-test-popover-open");
    if (wasOpen === open) return;
    element.toggleAttribute("data-test-popover-open", open);
    const event = new Event("toggle");
    Object.defineProperties(event, {
      oldState: { value: wasOpen ? "open" : "closed" },
      newState: { value: open ? "open" : "closed" },
    });
    element.dispatchEvent(event);
  }

  Object.defineProperties(prototype, {
    matches: {
      configurable: true,
      value(this: HTMLElement, selector: string) {
        return selector === ":popover-open"
          ? this.hasAttribute("data-test-popover-open")
          : originalMatches.call(this, selector);
      },
    },
    showPopover: {
      configurable: true,
      get(this: HTMLElement) {
        if (
          this.getAttribute("popover") !== "auto" &&
          !(
            this.getAttribute("popover") === "manual" &&
            ["listbox", "menu"].includes(this.getAttribute("role") ?? "")
          )
        )
          return descriptors.showPopover?.value;
        return function (this: HTMLElement) {
          toggle(this, true);
        };
      },
    },
    hidePopover: {
      configurable: true,
      get(this: HTMLElement) {
        if (
          this.getAttribute("popover") !== "auto" &&
          !(
            this.getAttribute("popover") === "manual" &&
            ["listbox", "menu"].includes(this.getAttribute("role") ?? "")
          )
        )
          return descriptors.hidePopover?.value;
        return function (this: HTMLElement) {
          toggle(this, false);
        };
      },
    },
  });

  function dismissOutside(event: Event) {
    // A native modal dialog prevents interaction with the underlying document.
    if (document.querySelector("dialog[open]")) return;
    for (const panel of document.querySelectorAll<HTMLElement>(
      '[popover="auto"][data-test-popover-open]',
    )) {
      const target = event.target as Element;
      const trigger = target.closest?.("[popovertarget]");
      if (
        !panel.contains(target) &&
        trigger?.getAttribute("popovertarget") !== panel.id
      )
        toggle(panel, false);
    }
  }
  document.addEventListener("pointerdown", dismissOutside);

  const resizeDescriptor = Object.getOwnPropertyDescriptor(
    window,
    "ResizeObserver",
  );
  if (!window.ResizeObserver) {
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    });
  }
  return () => {
    document.removeEventListener("pointerdown", dismissOutside);
    style.remove();
    for (const key of ["matches", "showPopover", "hidePopover"]) {
      const descriptor = descriptors[key];
      if (descriptor) Object.defineProperty(prototype, key, descriptor);
      else Reflect.deleteProperty(prototype, key);
    }
    if (resizeDescriptor)
      Object.defineProperty(window, "ResizeObserver", resizeDescriptor);
    else Reflect.deleteProperty(window, "ResizeObserver");
  };
}
