export interface CurrentUser {
  id: number;
  nickname: string;
}

export type AuthState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "onboardingRequired" }
  | { status: "synchronizing"; user: CurrentUser }
  | { status: "authenticated"; user: CurrentUser }
  | { status: "error" };
