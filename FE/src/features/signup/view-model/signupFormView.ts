import {
  SIGNUP_NICKNAME_MAX_LENGTH,
  SIGNUP_PASSWORD_MAX_LENGTH,
  SIGNUP_PASSWORD_MIN_LENGTH,
} from "../model/signup";

export const SIGNUP_FORM_GUIDANCE = {
  nickname: `닉네임은 ${SIGNUP_NICKNAME_MAX_LENGTH}자 이하로 입력해 주세요.`,
  password: `비밀번호는 ${SIGNUP_PASSWORD_MIN_LENGTH}자 이상 ${SIGNUP_PASSWORD_MAX_LENGTH}자 이하로 입력해 주세요.`,
} as const;
