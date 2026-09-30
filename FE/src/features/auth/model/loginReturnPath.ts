const CALENDAR_RETURN_PATH = "/calendar";

type LoginReturnPath = typeof CALENDAR_RETURN_PATH;

export function getSafeLoginReturnPath(search: string): LoginReturnPath | null {
  const returnTo = new URLSearchParams(search).get("returnTo");

  return returnTo === CALENDAR_RETURN_PATH ? CALENDAR_RETURN_PATH : null;
}
