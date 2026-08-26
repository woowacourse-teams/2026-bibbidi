export interface LoginFormValues {
  nickname: string;
  password: string;
}

export interface LoginValues {
  nickname: string;
  password: string;
}

export interface LoginResult {
  userId: number;
  nickname: string;
}

export type LoginFormField = keyof LoginFormValues;

export const LOGIN_FORM_ERROR_MESSAGE = "닉네임 또는 비밀번호를 확인해 주세요.";

export const initialLoginFormValues: LoginFormValues = {
  nickname: "",
  password: "",
};

export function isLoginFormValid(values: LoginFormValues): boolean {
  const nickname = values.nickname.trim();
  const password = values.password;

  return (
    Boolean(nickname) &&
    nickname.length <= 10 &&
    Boolean(password.trim()) &&
    password.length >= 4 &&
    password.length <= 20
  );
}

export function toLoginValues(values: LoginFormValues): LoginValues {
  return {
    nickname: values.nickname.trim(),
    password: values.password,
  };
}
