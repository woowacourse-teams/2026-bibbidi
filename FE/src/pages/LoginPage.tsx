import { Link } from "react-router";

import { LoginForm } from "../features/login";

export function LoginPage() {
  return <LoginForm signupLink={<Link to="/signup">회원가입</Link>} />;
}
