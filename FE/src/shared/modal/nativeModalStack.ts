type Entry = { dialog: HTMLDialogElement; priority: number };
const entries: Entry[] = [];

/** Keep existing confirmations above a panel/sheet mounted during a layout change. */
export function showLayer(dialog: HTMLDialogElement, priority: number) {
  const above = entries.filter(
    (entry) =>
      entry.dialog.ownerDocument === dialog.ownerDocument &&
      entry.dialog.open &&
      entry.priority > priority,
  );
  const active = dialog.ownerDocument.activeElement;
  dialog.showModal();
  entries.push({ dialog, priority });
  if (!above.length) {
    if (!dialog.contains(dialog.ownerDocument.activeElement))
      dialog.focus({ preventScroll: true });
  } else {
    above.forEach((entry) => {
      entry.dialog.close();
      entry.dialog.showModal();
    });
    if (
      active instanceof HTMLElement &&
      above.some((entry) => entry.dialog.contains(active))
    )
      active.focus({ preventScroll: true });
  }
  return () => {
    const index = entries.findIndex((entry) => entry.dialog === dialog);
    if (index !== -1) entries.splice(index, 1);
    dialog.close();
  };
}
