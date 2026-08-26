import { Link } from "react-router";

import { SignupForm } from "../features/signup";

export function SignupPage() {
  return <SignupForm loginLink={<Link to="/login">로그인</Link>} />;
}
