import {
  KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

export function useAppHeaderAccountMenu(navigationKey: string) {
  const [openState, setOpenState] = useState({ navigationKey, isOpen: false });
  const isOpen = openState.navigationKey === navigationKey && openState.isOpen;
  if (openState.navigationKey !== navigationKey) {
    setOpenState({ navigationKey, isOpen: false });
  }
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  function closePanel(restoreFocus: boolean) {
    if (panelRef.current?.querySelector('[role="dialog"]')) return false;
    setOpenState({ navigationKey, isOpen: false });
    if (restoreFocus) triggerRef.current?.focus();
    return true;
  }

  const dismiss = useEffectEvent(closePanel);
  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();

    function dismissOutside(event: Event) {
      if (
        event.target instanceof Node &&
        !panelRef.current?.contains(event.target) &&
        !triggerRef.current?.contains(event.target)
      )
        dismiss(false);
    }

    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented && dismiss(true)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    document.addEventListener("keydown", dismissOnEscape);
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    return () => {
      document.removeEventListener("keydown", dismissOnEscape);
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
    };
  }, [isOpen]);

  function togglePanel() {
    if (isOpen) closePanel(true);
    else setOpenState({ navigationKey, isOpen: true });
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    if (isOpen) closeRef.current?.focus();
    else setOpenState({ navigationKey, isOpen: true });
  }

  return {
    isOpen,
    panelRef,
    triggerRef,
    closeRef,
    closeAndRestoreFocus: () => {
      closePanel(true);
    },
    togglePanel,
    handleTriggerKeyDown,
  };
}
