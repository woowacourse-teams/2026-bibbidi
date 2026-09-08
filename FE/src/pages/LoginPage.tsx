import { Link, useNavigate } from "react-router";

import { useAuth } from "../features/auth";
import { LoginForm } from "../features/login";

export function LoginPage() {
  const { setAuthenticatedUser } = useAuth();
  const navigate = useNavigate();

  return (
    <LoginForm
      onSuccess={(result) => {
        setAuthenticatedUser({ nickname: result.nickname });
        navigate("/", { replace: true });
      }}
      signupLink={<Link to="/signup">회원가입</Link>}
    />
  );
}
