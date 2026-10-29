import { useCallback } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";

import {
  consumeLoginReturnPath,
  readLoginReturnPath,
} from "../features/auth/model/loginReturnPath";

import { acceptWebAccessToken, useAuth } from "../features/auth";
import {
  SocialLoginCallback,
  type SocialLoginSession,
} from "../features/social-login";

export function SocialLoginCallbackPage() {
  const { provider = "" } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const { beginOnboarding, refreshAuth } = useAuth();
  const handleSuccess = useCallback(
    (session: SocialLoginSession) => {
      acceptWebAccessToken(session.accessToken);

      if (session.termsAgreementRequired) {
        beginOnboarding();
        navigate("/onboarding", { replace: true });
        return;
      }

      const returnPath = consumeLoginReturnPath();
      refreshAuth();
      if (returnPath)
        navigate(`/login?${new URLSearchParams({ returnTo: returnPath })}`, {
          replace: true,
        });
    },
    [beginOnboarding, navigate, refreshAuth],
  );

  const returnPath = readLoginReturnPath();
  const loginPath = returnPath
    ? `/login?${new URLSearchParams({ returnTo: returnPath })}`
    : "/login";
  return (
    <SocialLoginCallback
      loginLink={<Link to={loginPath}>로그인으로 돌아가기</Link>}
      onSuccess={handleSuccess}
      provider={provider}
      search={search}
    />
  );
}
