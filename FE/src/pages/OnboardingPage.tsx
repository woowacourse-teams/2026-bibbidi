import { Navigate } from "react-router";
import { readLoginReturnPath } from "../features/auth/model/loginReturnPath";

export function OnboardingPage() {
  const returnTo = readLoginReturnPath() ?? "/";
  return (
    <Navigate replace to={returnTo} state={{ loginModal: { returnTo } }} />
  );
}
