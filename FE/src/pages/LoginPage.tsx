import { Link, useLocation, useNavigate } from "react-router";

import { getSafeLoginReturnPath, useAuth } from "../features/auth";
import { LoginForm } from "../features/login";

export function LoginPage() {
  const { beginAuthentication } = useAuth();
  const { search } = useLocation();
  const navigate = useNavigate();
  const returnPath = getSafeLoginReturnPath(search);

  return (
    <LoginForm
      onSuccess={(result) => {
        beginAuthentication({ nickname: result.nickname });
        navigate(returnPath ?? "/", { replace: true });
      }}
      signupLink={<Link to="/signup">회원가입</Link>}
    />
  );
}
