export interface SignupValues {
  nickname: string;
  password: string;
}

export interface SignupFormValues extends SignupValues {
  passwordConfirm: string;
}

export type SignupFormField = keyof SignupFormValues;
export type SignupFormErrors = Partial<Record<SignupFormField, string>>;

export const initialSignupFormValues: SignupFormValues = {
  nickname: "",
  password: "",
  passwordConfirm: "",
};

export function toSignupValues(values: SignupFormValues): SignupValues {
  return {
    nickname: values.nickname.trim(),
    password: values.password,
  };
}

export function validateSignupField(
  field: SignupFormField,
  values: SignupFormValues,
): string | undefined {
  if (field === "nickname") {
    const nickname = values.nickname.trim();

    if (!nickname) {
      return "닉네임을 입력해 주세요.";
    }

    if (nickname.length > 10) {
      return "닉네임은 10자 이하로 입력해 주세요.";
    }
  }

  if (field === "password") {
    if (!values.password) {
      return "비밀번호를 입력해 주세요.";
    }

    if (values.password.length < 4) {
      return "비밀번호는 4자 이상 입력해 주세요.";
    }

    if (values.password.length > 20) {
      return "비밀번호는 20자 이하로 입력해 주세요.";
    }
  }

  if (field === "passwordConfirm") {
    if (!values.passwordConfirm) {
      return "비밀번호를 다시 입력해 주세요.";
    }

    if (values.password !== values.passwordConfirm) {
      return "비밀번호가 일치하지 않습니다.";
    }
  }

  return undefined;
}

export function validateSignupForm(values: SignupFormValues): SignupFormErrors {
  return (Object.keys(values) as SignupFormField[]).reduce<SignupFormErrors>(
    (errors, field) => {
      const message = validateSignupField(field, values);

      if (message) {
        errors[field] = message;
      }

      return errors;
    },
    {},
  );
}
