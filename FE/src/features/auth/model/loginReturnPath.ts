export function getSafeLoginReturnPath(search: string): string | null {
  const returnTo = new URLSearchParams(search).get("returnTo");
  if (returnTo === "/calendar") return returnTo;
  // Only the calendar and a positive catalog ID are accepted, never arbitrary URLs.
  const match = /^\/calendar\?dateFor=([1-9]\d*)$/.exec(returnTo ?? "");
  return match && Number.isSafeInteger(Number(match[1])) ? returnTo : null;
}
