import { useRef, useState } from "react";

import {
  login,
  LoginApiError,
  LoginNetworkError,
  LoginResponse,
  LoginTimeoutError,
} from "../api/login";
import {
  initialLoginFormValues,
  isLoginFormValid,
  LOGIN_FORM_ERROR_MESSAGE,
  LoginFormField,
  LoginResult,
  toLoginValues,
} from "../model/login";

interface UseLoginFormOptions {
  onSuccess?: (result: LoginResult) => void;
}

type LoginSubmissionStatus = "idle" | "submitting" | "success";

export function useLoginForm({ onSuccess }: UseLoginFormOptions) {
  const [values, setValues] = useState(initialLoginFormValues);
  const [formError, setFormError] = useState<string>();
  const [formErrorRevision, setFormErrorRevision] = useState(0);
  const [submissionStatus, setSubmissionStatus] =
    useState<LoginSubmissionStatus>("idle");
  const submissionInProgress = useRef(false);

  const showFormError = (message: string) => {
    setFormError(message);
    setFormErrorRevision((currentRevision) => currentRevision + 1);
  };

  const setFieldValue = (field: LoginFormField, value: string) => {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
    setFormError(undefined);
  };

  const submit = async () => {
    if (submissionInProgress.current || submissionStatus === "success") {
      return;
    }

    if (!isLoginFormValid(values)) {
      showFormError(LOGIN_FORM_ERROR_MESSAGE);
      return;
    }

    submissionInProgress.current = true;
    setFormError(undefined);
    setSubmissionStatus("submitting");

    let result: LoginResponse;

    try {
      result = await login(toLoginValues(values));
    } catch (error) {
      setSubmissionStatus("idle");

      if (
        error instanceof LoginApiError &&
        (error.status === 400 || error.status === 401)
      ) {
        showFormError(LOGIN_FORM_ERROR_MESSAGE);
      } else if (error instanceof LoginNetworkError) {
        showFormError("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
      } else if (error instanceof LoginTimeoutError) {
        showFormError("요청 시간이 초과됐습니다. 다시 시도해 주세요.");
      } else {
        showFormError(
          "로그인 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }

      return;
    } finally {
      submissionInProgress.current = false;
    }

    setSubmissionStatus("success");
    onSuccess?.({
      userId: result.userId,
      nickname: result.nickname,
    });
  };

  const isSubmitting = submissionStatus === "submitting";
  const isSuccess = submissionStatus === "success";

  return {
    formError,
    formErrorRevision,
    isSubmitting,
    isSuccess,
    setFieldValue,
    submit,
    values,
  };
}
