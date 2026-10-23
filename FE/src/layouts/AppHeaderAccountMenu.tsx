import { ReactNode, useId } from "react";

import { useAppHeaderAccountMenu } from "./useAppHeaderAccountMenu";

import "./AppHeaderAccountMenu.css";

export interface AppHeaderAccountUser {
  isLoggingOut: boolean;
  logoutErrorMessage: string | null;
  onLogout: () => void;
  summary: ReactNode;
  userInitial: string;
}

export function AppHeaderAccountMenu({
  user,
  navigationKey,
}: {
  user: AppHeaderAccountUser;
  navigationKey: string;
}) {
  const {
    isOpen,
    panelRef,
    triggerRef,
    closeRef,
    closeAndRestoreFocus,
    togglePanel,
    handleTriggerKeyDown,
  } = useAppHeaderAccountMenu(navigationKey);
  const panelId = useId();
  const errorId = useId();

  return (
    <div className="app-header-account">
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="계정 메뉴"
        className="app-header-account__trigger"
        onClick={togglePanel}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
        type="button"
      >
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div
        aria-label="계정 메뉴"
        className="app-header-account__panel"
        hidden={!isOpen}
        id={panelId}
        ref={panelRef}
        role="dialog"
      >
        <div className="app-header-account__heading">
          <span
            aria-label={`현재 사용자 ${user.userInitial}`}
            className="app-header-account__avatar"
          >
            {user.userInitial}
          </span>
          <strong>내 계정</strong>
          <button
            aria-label="계정 메뉴 닫기"
            className="app-header-account__close"
            onClick={closeAndRestoreFocus}
            ref={closeRef}
            type="button"
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path d="m6 6 12 12M6 18 18 6" />
            </svg>
          </button>
        </div>
        {user.summary}
        <div className="app-header-account__actions">
          <button
            aria-busy={user.isLoggingOut}
            aria-describedby={user.logoutErrorMessage ? errorId : undefined}
            className="app-header-account__logout"
            disabled={user.isLoggingOut}
            onClick={user.onLogout}
            type="button"
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M14 8l4 4-4 4M8 12h10" />
            </svg>
            로그아웃
          </button>
          {user.isLoggingOut ? <p role="status">로그아웃 처리 중</p> : null}
          {user.logoutErrorMessage ? (
            <div className="app-header-account__error" role="alert">
              <span id={errorId}>{user.logoutErrorMessage}</span>
              <button
                disabled={user.isLoggingOut}
                onClick={user.onLogout}
                type="button"
              >
                다시 시도
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
