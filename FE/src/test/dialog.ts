export function installDialogMock() {
  const descriptors = Object.getOwnPropertyDescriptors(
    HTMLDialogElement.prototype,
  );
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
      },
    },
  });

  return () => {
    for (const method of ["showModal", "close"] as const) {
      if (descriptors[method])
        Object.defineProperty(
          HTMLDialogElement.prototype,
          method,
          descriptors[method],
        );
      else
        delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>)[
          method
        ];
    }
  };
}
