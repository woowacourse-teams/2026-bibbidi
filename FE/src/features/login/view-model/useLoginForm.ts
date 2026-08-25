import { useState } from "react";

import {
  initialLoginFormValues,
  isLoginFormValid,
  LOGIN_FORM_ERROR_MESSAGE,
  LoginFormField,
} from "../model/login";

export function useLoginForm() {
  const [values, setValues] = useState(initialLoginFormValues);
  const [formError, setFormError] = useState<string>();

  const setFieldValue = (field: LoginFormField, value: string) => {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
    setFormError(undefined);
  };

  const submit = () => {
    if (!isLoginFormValid(values)) {
      setFormError(LOGIN_FORM_ERROR_MESSAGE);
      return;
    }

    setFormError(undefined);
  };

  return {
    formError,
    setFieldValue,
    submit,
    values,
  };
}
