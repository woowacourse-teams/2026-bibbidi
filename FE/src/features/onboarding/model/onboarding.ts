export interface OnboardingTerm {
  id: number;
  code: string;
  version: string;
  title: string;
  content: string;
  required: boolean;
}

export interface RequiredTermsContract {
  terms: OnboardingTerm[];
  version: string;
}

export const ONBOARDING_NICKNAME_MAX_LENGTH = 10;

export function createRequiredTermsContract(
  terms: OnboardingTerm[],
): RequiredTermsContract | null {
  const requiredTerms = terms.filter((term) => term.required);
  const requiredVersions = requiredTerms.map((term) => term.version.trim());
  const versions = new Set(requiredVersions);

  if (
    requiredTerms.length === 0 ||
    requiredVersions.some((version) => !version) ||
    versions.size !== 1
  ) {
    return null;
  }

  return {
    terms: requiredTerms,
    version: [...versions][0] as string,
  };
}

export function validateOnboardingNickname(
  nickname: string,
): string | undefined {
  const trimmedNickname = nickname.trim();

  if (!trimmedNickname) {
    return "닉네임을 입력해 주세요.";
  }

  if (trimmedNickname.length > ONBOARDING_NICKNAME_MAX_LENGTH) {
    return `닉네임은 ${ONBOARDING_NICKNAME_MAX_LENGTH}자 이하로 입력해 주세요.`;
  }

  return undefined;
}

export function toOnboardingNickname(nickname: string): string {
  return nickname.trim();
}
