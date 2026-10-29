export function getSafeLoginReturnPath(search: string): string | null {
  const returnTo = new URLSearchParams(search).get("returnTo");
  if (returnTo === "/calendar" || returnTo === "/balance-game") return returnTo;
  // Allow only known internal destinations and a positive catalog ID.
  const match = /^\/calendar\?dateFor=([1-9]\d*)$/.exec(returnTo ?? "");
  return match && Number.isSafeInteger(Number(match[1])) ? returnTo : null;
}

const RETURN_PATH_KEY = "bibbidi:login:return-path:v1";
const RETURN_PATH_MAX_AGE = 30 * 60 * 1000;

/** OAuth와 신규 가입 온보딩을 거쳐도 허용된 내부 복귀 경로만 유지한다. */
export function rememberLoginReturnPath(search: string) {
  try {
    const path = getSafeLoginReturnPath(search);
    if (path)
      window.sessionStorage.setItem(
        RETURN_PATH_KEY,
        JSON.stringify({ path, savedAt: Date.now() }),
      );
    else window.sessionStorage.removeItem(RETURN_PATH_KEY);
  } catch {
    /* 로그인은 저장소 사용 가능 여부와 무관하게 진행한다. */
  }
}

export function readLoginReturnPath(): string | null {
  try {
    const value = JSON.parse(
      window.sessionStorage.getItem(RETURN_PATH_KEY) ?? "null",
    );
    if (
      !value ||
      typeof value.path !== "string" ||
      typeof value.savedAt !== "number" ||
      !Number.isFinite(value.savedAt) ||
      value.savedAt > Date.now() ||
      Date.now() - value.savedAt > RETURN_PATH_MAX_AGE
    )
      return null;
    return getSafeLoginReturnPath(
      `?${new URLSearchParams({ returnTo: value.path })}`,
    );
  } catch {
    return null;
  }
}

export function consumeLoginReturnPath(): string | null {
  const path = readLoginReturnPath();
  try {
    window.sessionStorage.removeItem(RETURN_PATH_KEY);
  } catch {
    /* 복귀는 계속한다. */
  }
  return path;
}
