import { useCallback } from "react";
import { Link, useNavigate } from "../../../app/navigation/navigation";

import {
  consumeLoginReturnPath,
  readLoginReturnPath,
} from "../../auth/model/loginReturnPath";

import { acceptWebAccessToken, useAuth } from "../../auth";
import { useLoginCallback } from "./callbackState";
import { SocialLoginCallback, type SocialLoginSession } from "../index";

export function SocialLoginResult({
  provider,
  search,
  returnTo,
}: {
  provider: string;
  search: string;
  returnTo: string;
}) {
  const navigate = useNavigate();
  const setCallback = useLoginCallback()?.setCallback;
  const { beginOnboarding, refreshAuth } = useAuth();
  const handleSuccess = useCallback(
    (session: SocialLoginSession) => {
      setCallback?.(null);
      acceptWebAccessToken(session.accessToken);

      if (session.termsAgreementRequired) {
        beginOnboarding();
        navigate(returnTo, {
          replace: true,
          state: { loginModal: { returnTo } },
        });
        return;
      }

      const returnPath = consumeLoginReturnPath();
      refreshAuth();
      navigate(returnPath ?? returnTo, { replace: true });
    },
    [beginOnboarding, navigate, refreshAuth, returnTo, setCallback],
  );

  const returnPath = readLoginReturnPath() ?? returnTo;
  return (
    <SocialLoginCallback
      loginLink={
        <Link
          to={returnPath}
          state={{ loginModal: { returnTo: returnPath } }}
          onClick={(event) => {
            if (
              event.button === 0 &&
              !event.metaKey &&
              !event.ctrlKey &&
              !event.altKey &&
              !event.shiftKey
            )
              setCallback?.(null);
          }}
        >
          로그인으로 돌아가기
        </Link>
      }
      onSuccess={handleSuccess}
      provider={provider}
      search={search}
    />
  );
}
