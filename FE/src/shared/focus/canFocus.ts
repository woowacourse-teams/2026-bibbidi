export function canFocus(target: unknown): target is HTMLElement {
  if (
    !(target instanceof HTMLElement) ||
    !target.isConnected ||
    target.matches(':disabled, [aria-disabled="true"], input[type="hidden"]') ||
    !target.matches(
      'button, input, select, textarea, a[href], area[href], [tabindex], [contenteditable]:not([contenteditable="false"]), summary, iframe, audio[controls], video[controls]',
    ) ||
    target.closest("[hidden], [inert], dialog:not([open])")
  )
    return false;
  for (
    let element: HTMLElement | null = target;
    element;
    element = element.parentElement
  ) {
    const style = getComputedStyle(element);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse" ||
      style.contentVisibility === "hidden"
    )
      return false;
  }
  return true;
}
