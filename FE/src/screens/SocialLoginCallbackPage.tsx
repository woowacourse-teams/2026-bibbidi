import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "../app/navigation/navigation";
import { readLoginReturnPath } from "../features/auth/model/loginReturnPath";
import { useLoginCallback } from "../features/social-login/view/callbackState";

/** Pass credentials in memory and clear the address before routing to the modal. */
export function SocialLoginCallbackPage({ provider }: { provider: string }) {
  const navigate = useNavigate();
  const { pathname, search, ready } = useLocation();
  const setCallback = useLoginCallback()?.setCallback;
  const consumed = useRef(false);

  useEffect(() => {
    if (consumed.current || !ready || !setCallback) return;
    consumed.current = true;
    const returnTo = readLoginReturnPath() ?? "/";
    navigate(pathname, { replace: true });
    setCallback({ provider, search, returnTo });
    navigate(returnTo, { replace: true });
  }, [navigate, pathname, provider, ready, search, setCallback]);

  return <p role="status">로그인 결과를 확인하고 있습니다.</p>;
}
