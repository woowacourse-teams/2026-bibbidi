import { Link, useNavigate } from "react-router";

import { SignupForm } from "../features/signup";

export function SignupPage() {
  const navigate = useNavigate();

  return (
    <SignupForm
      loginLink={<Link to="/login">로그인</Link>}
      onSuccess={() => navigate("/login", { replace: true })}
    />
  );
}
