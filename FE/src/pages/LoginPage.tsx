import { useLocation } from "react-router";
import { rememberLoginReturnPath } from "../features/auth/model/loginReturnPath";
import { SocialLoginForm } from "../features/social-login";

export function LoginPage() {
  const { search } = useLocation();
  return (
    <SocialLoginForm
      onAuthorizationStart={() => rememberLoginReturnPath(search)}
    />
  );
}
