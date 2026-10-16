/** 서버와 연동을 마친 제공자다. 나머지는 준비 중 안내를 보여 준다. */
const CONNECTED_SOCIAL_PROVIDERS = ["kakao", "google"];

export function isConnectedSocialProvider(provider: string): boolean {
  return CONNECTED_SOCIAL_PROVIDERS.includes(provider);
}

export interface SocialLoginSession {
  accessToken: string;
  termsAgreementRequired: boolean;
}

export type SocialLoginCallbackParams =
  { status: "ready"; code: string; state: string } | { status: "invalid" };

/** 제공자가 로그인 화면에서 돌려보낸 주소에서 서버로 넘길 값을 꺼낸다. */
export function readSocialLoginCallbackParams(
  search: string,
): SocialLoginCallbackParams {
  const params = new URLSearchParams(search);
  const code = params.get("code");
  const state = params.get("state");

  if (params.has("error") || !code || !state) {
    return { status: "invalid" };
  }

  return { status: "ready", code, state };
}
