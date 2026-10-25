// Every overlay shares ownership so only the last release restores scrolling.
const scrollLocks = new WeakMap<
  HTMLElement,
  { count: number; previous: string }
>();

export function lockScroll(element: HTMLElement) {
  const lock = scrollLocks.get(element) ?? {
    count: 0,
    previous: element.style.overflow,
  };
  scrollLocks.set(element, lock);
  lock.count++;
  element.style.overflow = "hidden";
  return () => {
    if (--lock.count === 0) {
      element.style.overflow = lock.previous;
      scrollLocks.delete(element);
    }
  };
}
