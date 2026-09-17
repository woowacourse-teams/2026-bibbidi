export interface CurrentUser {
  nickname: string;
}

export type AuthState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "synchronizing"; user: CurrentUser }
  | { status: "authenticated"; user: CurrentUser }
  | { status: "error" };
