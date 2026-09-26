export const ACCOUNT_SETUP_NICKNAME_MAX_LENGTH = 10;

export function validateAccountSetupNickname(
  nickname: string,
): string | undefined {
  const trimmedNickname = nickname.trim();

  if (!trimmedNickname) {
    return "닉네임을 입력해 주세요.";
  }

  if (trimmedNickname.length > ACCOUNT_SETUP_NICKNAME_MAX_LENGTH) {
    return `닉네임은 ${ACCOUNT_SETUP_NICKNAME_MAX_LENGTH}자 이하로 입력해 주세요.`;
  }

  return undefined;
}

export function toAccountSetupNickname(nickname: string): string {
  return nickname.trim();
}
