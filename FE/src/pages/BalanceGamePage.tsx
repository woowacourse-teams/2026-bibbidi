import { Navigate, useNavigate } from "react-router";
import { AppLayout } from "../components/app-layout";
import { Result } from "../components/result";
import { useAuth } from "../features/auth";
import { BalanceGameFeature } from "../features/balance-game/BalanceGameFeature";

export function BalanceGamePage() {
  const { authState, refreshAuth } = useAuth();
  const navigate = useNavigate();
  if (authState.status === "onboardingRequired")
    return <Navigate replace to="/onboarding" />;
  return (
    <AppLayout scroll="document" className="balance-game-layout">
      {authState.status === "authenticated" ? (
        <BalanceGameFeature
          key={authState.user.id}
          onAuthenticationRequired={refreshAuth}
        />
      ) : authState.status === "guest" ? (
        <main className="balance-game">
          <Result
            headingLevel={1}
            title="우리에게 맞는 결혼 준비를 찾아봐요"
            description="로그인하고 가볍게 골라보세요. 답변에 맞춰 준비할 일을 추천해 드려요."
            button={
              <Result.Button
                onClick={() => {
                  void navigate("/login?returnTo=%2Fbalance-game");
                }}
              >
                로그인하고 시작하기
              </Result.Button>
            }
          />
        </main>
      ) : (
        <main className="balance-game">
          <p role="status">로그인 상태를 확인하고 있어요.</p>
        </main>
      )}
    </AppLayout>
  );
}
