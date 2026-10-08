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
