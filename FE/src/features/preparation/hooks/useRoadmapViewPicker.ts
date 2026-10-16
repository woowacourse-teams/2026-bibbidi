import { useCallback, useEffect, useRef, useState } from "react";

import {
  MOBILE_LAYOUT_MEDIA_QUERY,
  useIsMobileLayout,
} from "../../../shared/responsive";
import { RoadmapView } from "../view/RoadmapViewSwitcher";

export function useRoadmapViewPicker({
  audience,
  onViewChange,
}: {
  audience: string;
  onViewChange: (view: RoadmapView) => void;
}) {
  const isMobile = useIsMobileLayout();
  const [pickerAudience, setPickerAudience] = useState<string | null>(null);
  const restorePickerFocus = useRef(false);
  const triggerRef = useCallback((node: HTMLButtonElement | null) => {
    if (node && restorePickerFocus.current) {
      node.focus();
      restorePickerFocus.current = false;
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.(MOBILE_LAYOUT_MEDIA_QUERY);
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (!event.matches) setPickerAudience(null);
    };
    mediaQuery?.addEventListener("change", closeOnDesktop);
    return () => mediaQuery?.removeEventListener("change", closeOnDesktop);
  }, []);

  const open = () => setPickerAudience(audience);
  const close = () => setPickerAudience(null);
  const select = (view: RoadmapView) => {
    restorePickerFocus.current = true;
    close();
    onViewChange(view);
  };

  return {
    isMobile,
    isOpen: isMobile && pickerAudience === audience,
    open,
    close,
    select,
    triggerRef,
  };
}
