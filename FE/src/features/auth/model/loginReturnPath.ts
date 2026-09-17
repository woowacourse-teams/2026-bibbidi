export const PLANNER_RETURN_PATH = "/planner";

export type LoginReturnPath = typeof PLANNER_RETURN_PATH;

export function getSafeLoginReturnPath(search: string): LoginReturnPath | null {
  const returnTo = new URLSearchParams(search).get("returnTo");

  return returnTo === PLANNER_RETURN_PATH ? PLANNER_RETURN_PATH : null;
}

export function createLoginPath(returnTo: LoginReturnPath) {
  const search = new URLSearchParams({ returnTo });

  return `/login?${search.toString()}`;
}
