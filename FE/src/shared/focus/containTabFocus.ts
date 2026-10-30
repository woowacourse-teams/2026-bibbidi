const focusableSelector = [
  "button",
  "[href]",
  "input",
  "select",
  "textarea",
  "[tabindex]",
].join(",");

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter((element) => {
    if (
      element.matches(':disabled, input[type="hidden"]') ||
      element.tabIndex < 0 ||
      element.closest("[hidden], [inert]")
    )
      return false;
    const visibility = getComputedStyle(element).visibility;
    if (visibility === "hidden" || visibility === "collapse") return false;
    // A child's computed display can remain visible under a display:none parent.
    for (
      let ancestor: HTMLElement | null = element;
      ancestor;
      ancestor = ancestor.parentElement
    ) {
      const style = getComputedStyle(ancestor);
      if (style.display === "none" || style.contentVisibility === "hidden")
        return false;
    }
    return true;
  });
}

interface TabKeyEvent {
  key: string;
  preventDefault: () => void;
  shiftKey: boolean;
}

export function containTabFocus(event: TabKeyEvent, container: HTMLElement) {
  if (event.key !== "Tab") {
    return;
  }

  const focusableElements = getFocusableElements(container);
  const first = focusableElements[0];
  const last = focusableElements.at(-1);

  if (!first || !last) {
    event.preventDefault();
    return;
  }

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function focusFirstElement(container: HTMLElement) {
  getFocusableElements(container)[0]?.focus();
}
