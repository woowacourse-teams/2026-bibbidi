export interface LoginFormValues {
  nickname: string;
  password: string;
}

export type LoginFormField = keyof LoginFormValues;

export const LOGIN_FORM_ERROR_MESSAGE = "닉네임 또는 비밀번호를 확인해 주세요.";

export const initialLoginFormValues: LoginFormValues = {
  nickname: "",
  password: "",
};

export function isLoginFormValid(values: LoginFormValues): boolean {
  const nickname = values.nickname.trim();

  return (
    Boolean(nickname) &&
    nickname.length <= 10 &&
    Boolean(values.password) &&
    values.password.length <= 20
  );
}
