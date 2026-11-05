const ACCOUNT_SETUP_CHOICE_KEY = "bibbidi.account-setup.choice";

export type AccountSetupChoice = "legacy";

function currentSessionStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readAccountSetupChoice(): AccountSetupChoice | undefined {
  try {
    const choice = currentSessionStorage()?.getItem(ACCOUNT_SETUP_CHOICE_KEY);

    return choice === "legacy" ? choice : undefined;
  } catch {
    return undefined;
  }
}

export function saveAccountSetupChoice(choice: AccountSetupChoice): void {
  try {
    currentSessionStorage()?.setItem(ACCOUNT_SETUP_CHOICE_KEY, choice);
  } catch {
    // 저장소를 쓸 수 없어도 현재 페이지에서는 React 상태로 선택을 유지한다.
  }
}

export function clearAccountSetupChoice(): void {
  try {
    currentSessionStorage()?.removeItem(ACCOUNT_SETUP_CHOICE_KEY);
  } catch {
    // 저장소 접근 실패가 이전 선택으로 돌아가는 동작을 막지 않게 한다.
  }
}
