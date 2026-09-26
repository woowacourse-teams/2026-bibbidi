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
  changeAccountNickname,
  transferLegacyAccount,
} from "./api/accountSetup";
import {
  toAccountSetupNickname,
  validateAccountSetupNickname,
} from "./model/accountSetup";

const AUTHENTICATION_ERROR_CODES = new Set([201, 204, 205, 206]);
const ACCOUNT_SETUP_ERROR_MESSAGE =
  "계정 설정을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.";

export type AccountSetupChoice = "legacy" | "new";

interface UseAccountSetupFlowOptions {
  onAuthenticationExpired: () => void;
  onSuccess: () => void;
  onTermsRequired: () => void;
}

export function useAccountSetupFlow({
  onAuthenticationExpired,
  onSuccess,
  onTermsRequired,
}: UseAccountSetupFlowOptions) {
  const [choice, setChoice] = useState<AccountSetupChoice>();
  const [legacyValues, setLegacyValues] = useState(initialLoginFormValues);
  const [nickname, setNickname] = useState("");
  const [nicknameTouched, setNicknameTouched] = useState(false);
  const [nicknameError, setNicknameError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requestControllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      requestControllerRef.current?.abort();
    },
    [],
  );

  const selectChoice = (nextChoice: AccountSetupChoice) => {
    if (isSubmitting) {
      return;
    }

    setChoice(nextChoice);
    setFormError(undefined);
    setNicknameError(undefined);
  };

  const returnToChoice = () => {
    if (isSubmitting) {
      return;
    }

    setChoice(undefined);
    setLegacyValues((currentValues) => ({
      ...currentValues,
      password: "",
    }));
    setFormError(undefined);
    setNicknameError(undefined);
  };

  const setLegacyFieldValue = (field: LoginFormField, value: string) => {
    setLegacyValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
    setFormError(undefined);
  };

  const handleNicknameChange = (value: string) => {
    setNickname(value);
    setFormError(undefined);
    setNicknameError(
      nicknameTouched ? validateAccountSetupNickname(value) : undefined,
    );
  };

  const handleNicknameBlur = () => {
    setNicknameTouched(true);
    setNicknameError(validateAccountSetupNickname(nickname));
  };

  const handleApiError = (error: AccountSetupApiError): boolean => {
    if (error.errorCode === 101 || error.errorCode === 202) {
      setLegacyValues((currentValues) => ({
        ...currentValues,
        password: "",
      }));
      setFormError(LOGIN_FORM_ERROR_MESSAGE);
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

      setFormError(
        "계정 이전이 완료되지 않았어요. 입력 정보를 확인하고 다시 시도해 주세요.",
      );
    } catch {
      if (!signal.aborted) {
        onAuthenticationExpired();
      }
    }
  };

  const submitLegacyAccount = async () => {
    if (isSubmitting || !isLoginFormValid(legacyValues)) {
      if (!isSubmitting) {
        setFormError(LOGIN_FORM_ERROR_MESSAGE);
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
    setFormError(undefined);

    try {
      const values = toLoginValues(legacyValues);
      const session = await transferLegacyAccount(
        values.nickname,
        values.password,
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
        setFormError(ACCOUNT_SETUP_ERROR_MESSAGE);
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

  const submitNewAccount = async () => {
    if (isSubmitting) {
      return;
    }

    const nextNicknameError = validateAccountSetupNickname(nickname);
    setNicknameTouched(true);
    setNicknameError(nextNicknameError);

    if (nextNicknameError) {
      return;
    }

    const controller = new AbortController();
    requestControllerRef.current = controller;
    setIsSubmitting(true);
    setFormError(undefined);

    try {
      await changeAccountNickname(
        toAccountSetupNickname(nickname),
        controller.signal,
      );
      onSuccess();
    } catch (error) {
      if (error instanceof AccountSetupRequestAbortedError) {
        return;
      }

      if (error instanceof AccountSetupAuthenticationRequiredError) {
        onAuthenticationExpired();
        return;
      }

      if (error instanceof AccountSetupApiError) {
        if (
          error.status === 401 ||
          AUTHENTICATION_ERROR_CODES.has(error.errorCode)
        ) {
          onAuthenticationExpired();
          return;
        }

        if (error.errorCode === 211) {
          onTermsRequired();
          return;
        }

        if (error.errorCode === 101) {
          setNicknameError("닉네임을 다시 확인해 주세요.");
          return;
        }
      }

      setFormError(ACCOUNT_SETUP_ERROR_MESSAGE);
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
    choice,
    formError,
    handleNicknameBlur,
    handleNicknameChange,
    isNewAccountFormValid: !validateAccountSetupNickname(nickname),
    isSubmitting,
    legacyValues,
    nickname,
    nicknameError,
    returnToChoice,
    selectChoice,
    setLegacyFieldValue,
    submitLegacyAccount,
    submitNewAccount,
  };
}
