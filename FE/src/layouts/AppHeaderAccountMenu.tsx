import { ReactNode, useId } from "react";

import { Button } from "../components/button";
import { IconButton } from "../components/icon-button";
import {
  HamburgerIcon,
  CloseIcon,
  LogoutIcon,
} from "../components/icons/ActionIcons";
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
      <IconButton
        aria-controls={panelId}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="계정 메뉴"
        onClick={togglePanel}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
        type="button"
        icon={<HamburgerIcon />}
        variant={isOpen ? "fill" : "clear"}
      />
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
          <IconButton
            aria-label="계정 메뉴 닫기"
            onClick={closeAndRestoreFocus}
            ref={closeRef}
            type="button"
            icon={<CloseIcon />}
          />
        </div>
        {user.summary}
        <div className="app-header-account__actions">
          <Button
            aria-busy={user.isLoggingOut}
            loading={user.isLoggingOut}
            aria-describedby={user.logoutErrorMessage ? errorId : undefined}
            className="app-header-account__logout"
            disabled={user.isLoggingOut}
            onClick={user.onLogout}
            type="button"
            color="dark"
            variant="weak"
            size="medium"
            display="block"
          >
            <span className="app-header-account__logout-content">
              <LogoutIcon size={18} />
              로그아웃
            </span>
          </Button>
          {user.isLoggingOut ? <p role="status">로그아웃 처리 중</p> : null}
          {user.logoutErrorMessage ? (
            <div className="app-header-account__error" role="alert">
              <span id={errorId}>{user.logoutErrorMessage}</span>
              <Button
                disabled={user.isLoggingOut}
                onClick={user.onLogout}
                type="button"
                color="dark"
                variant="weak"
                size="medium"
              >
                다시 시도
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
