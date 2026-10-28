export function getSafeLoginReturnPath(search: string): string | null {
  const returnTo = new URLSearchParams(search).get("returnTo");
  if (returnTo === "/calendar" || returnTo === "/balance-game") return returnTo;
  // Allow only known internal destinations and a positive catalog ID.
  const match = /^\/calendar\?dateFor=([1-9]\d*)$/.exec(returnTo ?? "");
  return match && Number.isSafeInteger(Number(match[1])) ? returnTo : null;
}
