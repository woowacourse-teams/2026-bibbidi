export function preventLinkDrag(event: Event) {
  if (event.target instanceof Element && event.target.closest("a")) {
    event.preventDefault();
  }
}
