import { useCallback, useEffect, useRef, useState } from "react";

import { WeddingDateLoadState } from "./model/weddingDate";
import {
  WeddingDateAuthenticationRequiredError,
  WeddingDateInvalidRequestError,
  WeddingDateRepository,
  WeddingDateRequestAbortedError,
} from "./repository/weddingDateRepository";

interface UseWeddingDateOptions {
  onAuthenticationRequired: () => void;
  repository: WeddingDateRepository;
}

export interface WeddingDateController {
  closePopover: () => void;
  currentDate: string | null;
  isPopoverOpen: boolean;
  isSaving: boolean;
  loadState: WeddingDateLoadState;
  openPopover: () => void;
  retryLoad: () => void;
  save: (date: string) => Promise<void>;
  saveError: string | null;
}

export function useWeddingDate({
  onAuthenticationRequired,
  repository,
}: UseWeddingDateOptions): WeddingDateController {
  const [loadState, setLoadState] = useState<WeddingDateLoadState>({
    status: "loading",
  });
  const [requestRevision, setRequestRevision] = useState(0);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveControllerRef = useRef<AbortController | null>(null);
  const isSavingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      saveControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    repository.getWeddingDate(controller.signal).then(
      (date) => {
        if (isActive) {
          setLoadState({ status: "loaded", date });
        }
      },
      (error: unknown) => {
        if (!isActive || error instanceof WeddingDateRequestAbortedError) {
          return;
        }

        if (error instanceof WeddingDateAuthenticationRequiredError) {
          onAuthenticationRequired();
          return;
        }

        setLoadState({ status: "error" });
      },
    );

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [onAuthenticationRequired, repository, requestRevision]);

  const closePopover = useCallback(() => {
    setIsPopoverOpen(false);
    setSaveError(null);
  }, []);

  const openPopover = useCallback(() => {
    setSaveError(null);
    setIsPopoverOpen(true);
  }, []);

  const retryLoad = useCallback(() => {
    setLoadState({ status: "loading" });
    setRequestRevision((revision) => revision + 1);
  }, []);

  const save = useCallback(
    async (date: string) => {
      if (isSavingRef.current) {
        return;
      }

      isSavingRef.current = true;
      const controller = new AbortController();
      saveControllerRef.current = controller;
      setIsSaving(true);
      setSaveError(null);

      try {
        const savedDate = await repository.saveWeddingDate(
          date,
          controller.signal,
        );
        if (!isMountedRef.current || controller.signal.aborted) {
          return;
        }

        setLoadState({ status: "loaded", date: savedDate });
        setIsPopoverOpen(false);
      } catch (error) {
        if (
          !isMountedRef.current ||
          error instanceof WeddingDateRequestAbortedError
        ) {
          return;
        }

        if (error instanceof WeddingDateAuthenticationRequiredError) {
          onAuthenticationRequired();
        } else if (error instanceof WeddingDateInvalidRequestError) {
          setSaveError("날짜를 확인한 뒤 다시 저장해 주세요.");
        } else {
          setSaveError(
            "결혼 예정일을 저장하지 못했습니다. 다시 시도해 주세요.",
          );
        }
      } finally {
        if (saveControllerRef.current === controller) {
          saveControllerRef.current = null;
        }
        isSavingRef.current = false;
        if (isMountedRef.current) {
          setIsSaving(false);
        }
      }
    },
    [onAuthenticationRequired, repository],
  );

  return {
    closePopover,
    currentDate: loadState.status === "loaded" ? loadState.date : null,
    isPopoverOpen,
    isSaving,
    loadState,
    openPopover,
    retryLoad,
    save,
    saveError,
  };
}
