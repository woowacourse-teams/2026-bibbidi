import { Navigate, useNavigate } from "react-router";
import { useAuth } from "../features/auth";
import { BalanceGameFeature } from "../features/balance-game/BalanceGameFeature";

export function BalanceGamePage() {
  const { authState, refreshAuth } = useAuth();
  const navigate = useNavigate();
  if (authState.status === "onboardingRequired")
    return <Navigate replace to="/onboarding" />;
  return (
    <>
      {authState.status === "authenticated" || authState.status === "guest" ? (
        <BalanceGameFeature
          key={
            authState.status === "authenticated" ? authState.user.id : "guest"
          }
          audience={authState.status}
          onAuthenticationRequired={refreshAuth}
          onLoginRequired={() =>
            void navigate("/login?returnTo=%2Fbalance-game")
          }
        />
      ) : (
        <main className="balance-game">
          <p role="status">로그인 상태를 확인하고 있어요.</p>
        </main>
      )}
    </>
  );
}
