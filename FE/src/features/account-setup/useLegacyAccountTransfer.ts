import { useEffect, useRef, useState } from "react";

import {
  acceptWebAccessToken,
  currentWebUserId,
  refreshWebSession,
  webUserIdFromAccessToken,
} from "../auth";
import {
  initialLoginFormValues,
  isLoginFormValid,
  LOGIN_FORM_ERROR_MESSAGE,
  LoginFormField,
  toLoginValues,
} from "../login/model/login";
import {
  AccountSetupApiError,
  AccountSetupAuthenticationRequiredError,
  AccountSetupNetworkError,
  AccountSetupRequestAbortedError,
  AccountSetupTimeoutError,
  transferLegacyAccount,
} from "./api/accountSetup";
import { ACCOUNT_SETUP_ERROR_MESSAGE } from "./model/accountSetupError";

const AUTHENTICATION_ERROR_CODES = new Set([201, 204, 205, 206]);

interface UseLegacyAccountTransferOptions {
  onAuthenticationExpired: () => void;
  onSuccess: () => void;
  onTermsRequired: () => void;
}

export function useLegacyAccountTransfer({
  onAuthenticationExpired,
  onSuccess,
  onTermsRequired,
}: UseLegacyAccountTransferOptions) {
  const [values, setValues] = useState(initialLoginFormValues);
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

  const resetForm = () => {
    setValues((currentValues) => ({
      ...currentValues,
      password: "",
    }));
    clearError();
  };

  const setFieldValue = (field: LoginFormField, value: string) => {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
    clearError();
  };

  const handleApiError = (error: AccountSetupApiError): boolean => {
    if (error.errorCode === 101 || error.errorCode === 202) {
      setValues((currentValues) => ({
        ...currentValues,
        password: "",
      }));
      setErrorMessage(LOGIN_FORM_ERROR_MESSAGE);
      return true;
    }

    if (
      error.status === 401 ||
      AUTHENTICATION_ERROR_CODES.has(error.errorCode)
    ) {
      onAuthenticationExpired();
      return true;
    }

    if (error.errorCode === 211) {
      onTermsRequired();
      return true;
    }

    return false;
  };

  const recoverUncertainTransfer = async (
    previousUserId: string,
    signal: AbortSignal,
  ) => {
    try {
      const session = await refreshWebSession();

      if (signal.aborted) {
        return;
      }

      const refreshedUserId = webUserIdFromAccessToken(session.accessToken);

      if (refreshedUserId && refreshedUserId !== previousUserId) {
        onSuccess();
        return;
      }

      setErrorMessage(
        "계정 이전이 완료되지 않았어요. 입력 정보를 확인하고 다시 시도해 주세요.",
      );
    } catch {
      if (!signal.aborted) {
        onAuthenticationExpired();
      }
    }
  };

  const submit = async () => {
    if (isSubmitting || !isLoginFormValid(values)) {
      if (!isSubmitting) {
        setErrorMessage(LOGIN_FORM_ERROR_MESSAGE);
      }
      return;
    }

    const previousUserId = currentWebUserId();

    if (!previousUserId) {
      onAuthenticationExpired();
      return;
    }

    const controller = new AbortController();
    requestControllerRef.current = controller;
    setIsSubmitting(true);
    clearError();

    try {
      const loginValues = toLoginValues(values);
      const session = await transferLegacyAccount(
        loginValues.nickname,
        loginValues.password,
        controller.signal,
      );
      acceptWebAccessToken(session.accessToken);

      if (session.termsAgreementRequired) {
        onTermsRequired();
      } else {
        onSuccess();
      }
    } catch (error) {
      if (error instanceof AccountSetupRequestAbortedError) {
        return;
      }

      if (error instanceof AccountSetupAuthenticationRequiredError) {
        onAuthenticationExpired();
        return;
      }

      if (
        error instanceof AccountSetupNetworkError ||
        error instanceof AccountSetupTimeoutError
      ) {
        await recoverUncertainTransfer(previousUserId, controller.signal);
      } else if (
        !(error instanceof AccountSetupApiError) ||
        !handleApiError(error)
      ) {
        setErrorMessage(ACCOUNT_SETUP_ERROR_MESSAGE);
      }
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
    resetForm,
    setFieldValue,
    submit,
    values,
  };
}
