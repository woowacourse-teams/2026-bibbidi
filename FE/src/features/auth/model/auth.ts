export interface CurrentUser {
  nickname: string;
}

export type AuthState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "authenticated"; user: CurrentUser }
  | { status: "error" };
