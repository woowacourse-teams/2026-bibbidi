import { useEffect } from "react";
import { useNavigate } from "../app/navigation/navigation";
import { readLoginReturnPath } from "../features/auth/model/loginReturnPath";

export function OnboardingPage() {
  const navigate = useNavigate();
  useEffect(() => {
    const returnTo = readLoginReturnPath() ?? "/";
    navigate(returnTo, { replace: true, state: { loginModal: { returnTo } } });
  }, [navigate]);
  return null;
}
