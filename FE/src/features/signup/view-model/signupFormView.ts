import {
  SIGNUP_NICKNAME_MAX_LENGTH,
  SIGNUP_PASSWORD_MAX_LENGTH,
  SIGNUP_PASSWORD_MIN_LENGTH,
} from "../model/signup";

export const SIGNUP_FORM_GUIDANCE = {
  nickname: `닉네임은 ${SIGNUP_NICKNAME_MAX_LENGTH}자 이하로 입력해 주세요.`,
  password: `비밀번호는 ${SIGNUP_PASSWORD_MIN_LENGTH}자 이상 ${SIGNUP_PASSWORD_MAX_LENGTH}자 이하로 입력해 주세요.`,
} as const;

export type NicknameAvailabilityStatus =
  "idle" | "checking" | "available" | "unavailable" | "error";

export function createNicknameMessage(
  error: string | undefined,
  status: NicknameAvailabilityStatus,
): string {
  if (error) {
    return error;
  }

  if (status === "checking") {
    return "닉네임 중복을 확인하고 있습니다.";
  }

  if (status === "available") {
    return "사용 가능한 닉네임입니다.";
  }

  return SIGNUP_FORM_GUIDANCE.nickname;
}
