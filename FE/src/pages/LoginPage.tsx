import { Link, useNavigate } from "react-router";

import { LoginForm } from "../features/login";

export function LoginPage() {
  const navigate = useNavigate();

  return (
    <LoginForm
      onSuccess={() => navigate("/", { replace: true })}
      signupLink={<Link to="/signup">회원가입</Link>}
    />
  );
}
