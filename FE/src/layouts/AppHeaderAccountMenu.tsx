import { ReactNode, useId } from "react";

import { FeedbackFeature } from "../features/feedback";
import { IconButton } from "../components/icon-button";
import {
  HamburgerIcon,
  LogoutIcon,
  RetryIcon,
} from "../components/icons/ActionIcons";
import { ListRow } from "../components/list-row";
import { Popover } from "../components/popover";
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
  const { isOpen, onOpenChange } = useAppHeaderAccountMenu(navigationKey);
  const errorId = useId();

  return (
    <FeedbackFeature
      renderTrigger={(openFeedback, returnFocusRef) => (
        <Popover
          title="계정 메뉴"
          placement="bottom-end"
          width={360}
          open={isOpen}
          onOpenChange={onOpenChange}
          trigger={
            <IconButton
              ref={returnFocusRef}
              aria-label="계정 메뉴"
              icon={<HamburgerIcon />}
              variant={isOpen ? "fill" : "clear"}
            />
          }
        >
          <ListRow
            border="none"
            horizontalPadding="small"
            left={
              <ListRow.Asset
                shape="circle"
                aria-label={`현재 사용자 ${user.userInitial}`}
              >
                {user.userInitial}
              </ListRow.Asset>
            }
            contents={<ListRow.Texts top="내 계정" />}
          />
          {user.summary}
          <ul aria-label="계정 동작" className="app-header-account__actions">
            <li>
              <ListRow
                horizontalPadding="small"
                contents={<ListRow.Texts top="의견 보내기" />}
                onClick={() => {
                  onOpenChange(false);
                  openFeedback();
                }}
              />
            </li>
            <li>
              <ListRow
                aria-busy={user.isLoggingOut}
                aria-describedby={user.logoutErrorMessage ? errorId : undefined}
                horizontalPadding="small"
                left={<LogoutIcon size={20} />}
                contents={<ListRow.Texts top="로그아웃" />}
                disabled={user.isLoggingOut}
                onClick={user.onLogout}
              />
            </li>
          </ul>
          {user.isLoggingOut ? (
            <p className="app-header-account__status" role="status">
              로그아웃 처리 중
            </p>
          ) : null}
          {user.logoutErrorMessage ? (
            <ListRow
              className="app-header-account__error"
              role="alert"
              border="none"
              horizontalPadding="small"
              contents={<span id={errorId}>{user.logoutErrorMessage}</span>}
              right={
                <IconButton
                  icon={<RetryIcon />}
                  iconSize={20}
                  aria-label="로그아웃 다시 시도"
                  title="로그아웃 다시 시도"
                  disabled={user.isLoggingOut}
                  onClick={user.onLogout}
                />
              }
            />
          ) : null}
        </Popover>
      )}
    />
  );
}
