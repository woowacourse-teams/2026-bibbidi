const ACCOUNT_SETUP_PROGRESS_KEY = "bibbidi.account-setup.pending";

let pendingInMemory = false;

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

export function beginAccountSetupProgress(): void {
  pendingInMemory = true;

  try {
    currentSessionStorage()?.setItem(ACCOUNT_SETUP_PROGRESS_KEY, "true");
  } catch {
    // 저장소를 쓸 수 없는 환경에서도 현재 페이지 흐름은 메모리로 유지한다.
  }
}

export function clearAccountSetupProgress(): void {
  pendingInMemory = false;

  try {
    currentSessionStorage()?.removeItem(ACCOUNT_SETUP_PROGRESS_KEY);
  } catch {
    // 저장소 접근 실패가 로그아웃이나 완료 처리를 막지 않게 한다.
  }
}

export function hasAccountSetupProgress(): boolean {
  if (pendingInMemory) {
    return true;
  }

  try {
    return (
      currentSessionStorage()?.getItem(ACCOUNT_SETUP_PROGRESS_KEY) === "true"
    );
  } catch {
    return false;
  }
}
