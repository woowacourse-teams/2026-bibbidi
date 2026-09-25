import { Link, useLocation, useParams } from "react-router";

import { SocialLoginCallback } from "../features/social-login";

export function SocialLoginCallbackPage() {
  const { provider = "" } = useParams();
  const { search } = useLocation();

  return (
    <SocialLoginCallback
      loginLink={<Link to="/login">로그인으로 돌아가기</Link>}
      provider={provider}
      search={search}
    />
  );
}
