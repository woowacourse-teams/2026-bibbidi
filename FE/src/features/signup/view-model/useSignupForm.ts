import { useRef, useState } from "react";

import {
  createUser,
  CreateUserApiError,
  CreateUserNetworkError,
  CreateUserResponse,
  CreateUserTimeoutError,
} from "../api/createUser";
import {
  initialSignupFormValues,
  SignupFormErrors,
  SignupFormField,
  SignupResult,
  toSignupValues,
  validateSignupField,
  validateSignupForm,
} from "../model/signup";

interface UseSignupFormOptions {
  onSuccess?: (result: SignupResult) => void;
}

type SignupFormTouchedFields = Partial<Record<SignupFormField, boolean>>;

type SignupSubmissionStatus = "idle" | "submitting" | "success";

function toServerFieldErrors(error: CreateUserApiError): SignupFormErrors {
  return error.fieldErrors.reduce<SignupFormErrors>((fieldErrors, item) => {
    if (item.field === "nickname" || item.field === "password") {
      fieldErrors[item.field] = item.message;
    }

    return fieldErrors;
  }, {});
}

export function useSignupForm({ onSuccess }: UseSignupFormOptions) {
  const [values, setValues] = useState(initialSignupFormValues);
  const [errors, setErrors] = useState<SignupFormErrors>({});
  const [formError, setFormError] = useState<string>();
  const [submissionStatus, setSubmissionStatus] =
    useState<SignupSubmissionStatus>("idle");
  const [touchedFields, setTouchedFields] = useState<SignupFormTouchedFields>(
    {},
  );
  const submissionInProgress = useRef(false);

  const setFieldValue = (field: SignupFormField, value: string) => {
    const nextValues = { ...values, [field]: value };

    setValues(nextValues);
    setFormError(undefined);
    setErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };

      if (touchedFields[field]) {
        nextErrors[field] = validateSignupField(field, nextValues);
      }

      if (field === "password" && touchedFields.passwordConfirm) {
        nextErrors.passwordConfirm = validateSignupField(
          "passwordConfirm",
          nextValues,
        );
      }

      return nextErrors;
    });
  };

  const validateFieldOnBlur = (field: SignupFormField) => {
    setTouchedFields((currentFields) => ({
      ...currentFields,
      [field]: true,
    }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: validateSignupField(field, values),
    }));
  };

  const submit = async () => {
    if (submissionInProgress.current || submissionStatus === "success") {
      return;
    }

    const nextErrors = validateSignupForm(values);

    setTouchedFields({
      nickname: true,
      password: true,
      passwordConfirm: true,
    });
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    submissionInProgress.current = true;
    setFormError(undefined);
    setSubmissionStatus("submitting");

    let user: CreateUserResponse;

    try {
      user = await createUser(toSignupValues(values));
    } catch (error) {
      setSubmissionStatus("idle");

      if (error instanceof CreateUserApiError) {
        const serverFieldErrors = toServerFieldErrors(error);

        if (Object.keys(serverFieldErrors).length > 0) {
          setErrors((currentErrors) => ({
            ...currentErrors,
            ...serverFieldErrors,
          }));
        } else {
          setFormError(error.message);
        }
      } else if (error instanceof CreateUserNetworkError) {
        setFormError("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
      } else if (error instanceof CreateUserTimeoutError) {
        setFormError("요청 시간이 초과됐습니다. 다시 시도해 주세요.");
      } else {
        setFormError(
          "회원가입 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }

      return;
    } finally {
      submissionInProgress.current = false;
    }

    setSubmissionStatus("success");
    onSuccess?.({
      id: user.id,
      nickname: user.nickname,
    });
  };

  const isSubmitting = submissionStatus === "submitting";
  const isSuccess = submissionStatus === "success";

  return {
    errors,
    formError,
    isSubmitting,
    isSuccess,
    setFieldValue,
    submit,
    validateFieldOnBlur,
    values,
  };
}
