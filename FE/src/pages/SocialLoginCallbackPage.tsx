import { Navigate, useLocation, useParams } from "react-router";
import { readLoginReturnPath } from "../features/auth/model/loginReturnPath";

/** Strip provider credentials from the URL before showing the result in the modal. */
export function SocialLoginCallbackPage() {
  const { provider = "" } = useParams();
  const { search } = useLocation();
  const returnTo = readLoginReturnPath() ?? "/";
  return (
    <Navigate
      replace
      to={returnTo}
      state={{ loginModal: { returnTo, callback: { provider, search } } }}
    />
  );
}
