import { useCallback, useState } from "react";

export function useAppHeaderAccountMenu(navigationKey: string) {
  const [openState, setOpenState] = useState({ navigationKey, isOpen: false });
  const isOpen = openState.navigationKey === navigationKey && openState.isOpen;
  if (openState.navigationKey !== navigationKey) {
    setOpenState({ navigationKey, isOpen: false });
  }
  const onOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpenState({ navigationKey, isOpen: nextOpen });
    },
    [navigationKey],
  );

  return { isOpen, onOpenChange };
}
