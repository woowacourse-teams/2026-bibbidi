import { useRef, useState } from "react";

import {
  checkNicknameAvailability,
  NicknameAvailabilityApiError,
} from "../api/checkNicknameAvailability";
import {
  createUser,
  CreateUserApiError,
  CreateUserNetworkError,
  CreateUserTimeoutError,
} from "../api/createUser";
import {
  initialSignupFormValues,
  isSignupFormValid,
  SignupFormErrors,
  SignupFormField,
  SignupResult,
  toSignupValues,
  validateSignupField,
  validateSignupForm,
} from "../model/signup";
import {
  createNicknameMessage,
  NicknameAvailabilityStatus,
} from "./signupFormView";

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
  const [nicknameAvailabilityStatus, setNicknameAvailabilityStatus] =
    useState<NicknameAvailabilityStatus>("idle");
  const [touchedFields, setTouchedFields] = useState<SignupFormTouchedFields>(
    {},
  );
  const submissionInProgress = useRef(false);
  const nicknameCheckRevision = useRef(0);

  const setFieldValue = (field: SignupFormField, value: string) => {
    const nextValues = { ...values, [field]: value };

    setValues(nextValues);
    setFormError(undefined);

    if (field === "nickname") {
      nicknameCheckRevision.current += 1;
      setNicknameAvailabilityStatus("idle");
    }
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

  const validateFieldOnBlur = async (field: SignupFormField) => {
    const fieldError = validateSignupField(field, values);

    setTouchedFields((currentFields) => ({
      ...currentFields,
      [field]: true,
    }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: fieldError,
    }));

    if (field !== "nickname" || fieldError) {
      return;
    }

    const nickname = values.nickname.trim();
    const requestRevision = nicknameCheckRevision.current + 1;

    nicknameCheckRevision.current = requestRevision;
    setNicknameAvailabilityStatus("checking");

    try {
      const result = await checkNicknameAvailability(nickname);

      if (nicknameCheckRevision.current !== requestRevision) {
        return;
      }

      if (result.available) {
        setNicknameAvailabilityStatus("available");
        return;
      }

      setNicknameAvailabilityStatus("unavailable");
      setErrors((currentErrors) => ({
        ...currentErrors,
        nickname: "이미 사용 중인 닉네임입니다.",
      }));
    } catch (error) {
      if (nicknameCheckRevision.current !== requestRevision) {
        return;
      }

      setNicknameAvailabilityStatus("error");
      const nicknameFieldError =
        error instanceof NicknameAvailabilityApiError && error.errorCode === 101
          ? error.fieldErrors.find((item) => item.field === "nickname")
          : undefined;
      setErrors((currentErrors) => ({
        ...currentErrors,
        nickname:
          nicknameFieldError?.message ??
          "닉네임 중복을 확인하지 못했습니다. 다시 시도해 주세요.",
      }));
    }
  };

  const submit = async () => {
    if (submissionInProgress.current || submissionStatus === "success") {
      return;
    }

    const nextErrors = validateSignupForm(values);

    if (nicknameAvailabilityStatus === "unavailable") {
      nextErrors.nickname = "이미 사용 중인 닉네임입니다.";
    } else if (nicknameAvailabilityStatus === "error") {
      nextErrors.nickname =
        "닉네임 중복을 확인하지 못했습니다. 다시 시도해 주세요.";
    } else if (nicknameAvailabilityStatus === "idle") {
      nextErrors.nickname = "닉네임 입력 후 중복을 확인해 주세요.";
    }

    setTouchedFields({
      nickname: true,
      password: true,
      passwordConfirm: true,
    });
    setErrors(nextErrors);

    if (
      Object.keys(nextErrors).length > 0 ||
      nicknameAvailabilityStatus !== "available"
    ) {
      return;
    }

    submissionInProgress.current = true;
    setFormError(undefined);
    setSubmissionStatus("submitting");

    let user: SignupResult;

    try {
      user = await createUser(toSignupValues(values));
    } catch (error) {
      setSubmissionStatus("idle");

      if (error instanceof CreateUserApiError) {
        if (error.errorCode === 401) {
          setNicknameAvailabilityStatus("unavailable");
          setErrors((currentErrors) => ({
            ...currentErrors,
            nickname: "이미 사용 중인 닉네임입니다.",
          }));
          return;
        }

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
  const isFormValid =
    isSignupFormValid(values) && nicknameAvailabilityStatus === "available";
  const nicknameMessage = createNicknameMessage(
    errors.nickname,
    nicknameAvailabilityStatus,
  );

  return {
    errors,
    formError,
    isFormValid,
    isSubmitting,
    isSuccess,
    nicknameMessage,
    setFieldValue,
    submit,
    validateFieldOnBlur,
    values,
  };
}
