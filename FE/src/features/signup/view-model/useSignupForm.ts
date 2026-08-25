import { useState } from "react";

import {
  initialSignupFormValues,
  SignupFormErrors,
  SignupFormField,
  SignupValues,
  toSignupValues,
  validateSignupField,
  validateSignupForm,
} from "../model/signup";

interface UseSignupFormOptions {
  onValidSubmit?: (values: SignupValues) => void;
}

type SignupFormTouchedFields = Partial<Record<SignupFormField, boolean>>;

export function useSignupForm({ onValidSubmit }: UseSignupFormOptions) {
  const [values, setValues] = useState(initialSignupFormValues);
  const [errors, setErrors] = useState<SignupFormErrors>({});
  const [touchedFields, setTouchedFields] = useState<SignupFormTouchedFields>(
    {},
  );

  const setFieldValue = (field: SignupFormField, value: string) => {
    const nextValues = { ...values, [field]: value };

    setValues(nextValues);
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

  const submit = () => {
    const nextErrors = validateSignupForm(values);

    setTouchedFields({
      nickname: true,
      password: true,
      passwordConfirm: true,
    });
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length === 0) {
      onValidSubmit?.(toSignupValues(values));
    }
  };

  return {
    errors,
    setFieldValue,
    submit,
    validateFieldOnBlur,
    values,
  };
}
