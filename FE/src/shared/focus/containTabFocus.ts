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
  ).filter((element) => !element.matches(":disabled") && element.tabIndex >= 0);
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
