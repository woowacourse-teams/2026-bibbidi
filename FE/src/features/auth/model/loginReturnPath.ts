const PLANNER_RETURN_PATH = "/planner";

type LoginReturnPath = typeof PLANNER_RETURN_PATH;

export function getSafeLoginReturnPath(search: string): LoginReturnPath | null {
  const returnTo = new URLSearchParams(search).get("returnTo");

  return returnTo === PLANNER_RETURN_PATH ? PLANNER_RETURN_PATH : null;
}
