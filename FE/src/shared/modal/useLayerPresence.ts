import { useCallback, useState } from "react";

/** Keep layout space until the layer reports a completed exit. */
export function useLayerPresence(open: boolean) {
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);
  const onExited = useCallback(() => {
    if (!open) setPresent(false);
  }, [open]);
  return { present, onExited };
}

/** Retain display data during exit without taking ownership of screen state. */
export function useExitSnapshot<T>(
  open: boolean,
  value: T,
  capture = true,
): T | null {
  const [snapshot, setSnapshot] = useState({
    source: value,
    value: capture ? value : null,
  });
  if (open && snapshot.source !== value)
    setSnapshot({ source: value, value: capture ? value : snapshot.value });
  return open ? value : snapshot.value;
}
