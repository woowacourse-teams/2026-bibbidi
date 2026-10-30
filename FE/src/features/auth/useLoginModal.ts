import { useLocation, useNavigate } from "react-router";
import { getSafeLoginReturnPath } from "./model/loginReturnPath";

export interface LoginModalState {
  loginModal?: {
    returnTo: string;
    hasBackground?: boolean;
    callback?: { provider: string; search: string };
  };
}

export function useLoginModal(returnTo?: string) {
  const location = useLocation();
  const navigate = useNavigate();
  const destination =
    returnTo ?? `${location.pathname}${location.search}${location.hash}`;
  const safeReturnTo =
    getSafeLoginReturnPath(
      `?${new URLSearchParams({ returnTo: destination })}`,
    ) ??
    getSafeLoginReturnPath(
      `?${new URLSearchParams({ returnTo: location.pathname })}`,
    ) ??
    "/";
  const loginTo = {
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
  };
  const loginState = {
    ...location.state,
    loginModal: { returnTo: safeReturnTo, hasBackground: true },
  };

  return {
    loginTo,
    loginState,
    openLogin: () =>
      void navigate(loginTo, { state: loginState, preventScrollReset: true }),
  };
}
