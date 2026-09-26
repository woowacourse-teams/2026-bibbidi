import { useCallback } from "react";
import { Link, useLocation, useParams } from "react-router";

import { acceptWebAccessToken, useAuth } from "../features/auth";
import {
  SocialLoginCallback,
  type SocialLoginSession,
} from "../features/social-login";

export function SocialLoginCallbackPage() {
  const { provider = "" } = useParams();
  const { search } = useLocation();
  const { refreshAuth } = useAuth();
  const handleSuccess = useCallback(
    (session: SocialLoginSession) => {
      acceptWebAccessToken(session.accessToken);

      if (!session.termsAgreementRequired) {
        refreshAuth();
      }
    },
    [refreshAuth],
  );

  return (
    <SocialLoginCallback
      loginLink={<Link to="/login">로그인으로 돌아가기</Link>}
      onSuccess={handleSuccess}
      provider={provider}
      search={search}
    />
  );
}
