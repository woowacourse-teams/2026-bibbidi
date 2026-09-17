export interface SignupValues {
  nickname: string;
  password: string;
}

export interface SignupResult {
  id: number;
  nickname: string;
}

export interface SignupFormValues extends SignupValues {
  passwordConfirm: string;
}

export type SignupFormField = keyof SignupFormValues;
export type SignupFormErrors = Partial<Record<SignupFormField, string>>;

export const SIGNUP_NICKNAME_MAX_LENGTH = 10;
export const SIGNUP_PASSWORD_MIN_LENGTH = 4;
export const SIGNUP_PASSWORD_MAX_LENGTH = 20;

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

    if (nickname.length > SIGNUP_NICKNAME_MAX_LENGTH) {
      return `닉네임은 ${SIGNUP_NICKNAME_MAX_LENGTH}자 이하로 입력해 주세요.`;
    }
  }

  if (field === "password") {
    if (!values.password) {
      return "비밀번호를 입력해 주세요.";
    }

    if (values.password.length < SIGNUP_PASSWORD_MIN_LENGTH) {
      return `비밀번호는 ${SIGNUP_PASSWORD_MIN_LENGTH}자 이상 입력해 주세요.`;
    }

    if (values.password.length > SIGNUP_PASSWORD_MAX_LENGTH) {
      return `비밀번호는 ${SIGNUP_PASSWORD_MAX_LENGTH}자 이하로 입력해 주세요.`;
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

export function isSignupFormValid(values: SignupFormValues): boolean {
  return Object.keys(validateSignupForm(values)).length === 0;
}
