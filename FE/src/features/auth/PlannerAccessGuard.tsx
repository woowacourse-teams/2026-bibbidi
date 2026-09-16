import { Navigate, Outlet } from "react-router";

import { useAuth } from "./AuthProvider";
import { createLoginPath, PLANNER_RETURN_PATH } from "./model/loginReturnPath";

export function PlannerAccessGuard() {
  const { authState } = useAuth();

  if (authState.status === "loading" || authState.status === "synchronizing") {
    return (
      <main aria-label="플래너">
        <p role="status">로그인 상태를 확인하고 있습니다.</p>
      </main>
    );
  }

  if (authState.status === "guest") {
    return <Navigate replace to={createLoginPath(PLANNER_RETURN_PATH)} />;
  }

  if (authState.status === "authenticated") {
    return <Outlet />;
  }

  return null;
}
