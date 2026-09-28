import { useEffect, useRef, useState } from "react";

import {
  MyChecklistAuthenticationRequiredError,
  MyChecklistRequestAbortedError,
  useMyChecklistCommandRepository,
} from "../checklist";
import { ACCOUNT_SETUP_ERROR_MESSAGE } from "./model/accountSetupError";

interface UseNewAccountStartOptions {
  onAuthenticationExpired: () => void;
  onSuccess: () => void;
}

export function useNewAccountStart({
  onAuthenticationExpired,
  onSuccess,
}: UseNewAccountStartOptions) {
  const checklistCommandRepository = useMyChecklistCommandRepository();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requestControllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      requestControllerRef.current?.abort();
    },
    [],
  );

  const clearError = () => setErrorMessage(undefined);

  const submit = async () => {
    if (isSubmitting) {
      return;
    }

    const controller = new AbortController();
    requestControllerRef.current = controller;
    setIsSubmitting(true);
    clearError();

    try {
      await checklistCommandRepository.ensureChecklist(controller.signal);
      onSuccess();
    } catch (error) {
      if (error instanceof MyChecklistRequestAbortedError) {
        return;
      }

      if (error instanceof MyChecklistAuthenticationRequiredError) {
        onAuthenticationExpired();
        return;
      }

      setErrorMessage(ACCOUNT_SETUP_ERROR_MESSAGE);
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }

      if (!controller.signal.aborted) {
        setIsSubmitting(false);
      }
    }
  };

  return {
    clearError,
    errorMessage,
    isSubmitting,
    submit,
  };
}
