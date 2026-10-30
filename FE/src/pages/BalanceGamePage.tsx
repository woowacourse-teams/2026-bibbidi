import { useLoginModal } from "../features/auth/useLoginModal";
import { useAuth } from "../features/auth";
import { BalanceGameFeature } from "../features/balance-game/BalanceGameFeature";

export function BalanceGamePage() {
  const { authState, refreshAuth } = useAuth();
  const { openLogin } = useLoginModal();
  return (
    <>
      {authState.status === "authenticated" || authState.status === "guest" ? (
        <BalanceGameFeature
          key={
            authState.status === "authenticated" ? authState.user.id : "guest"
          }
          audience={authState.status}
          onAuthenticationRequired={refreshAuth}
          onLoginRequired={openLogin}
        />
      ) : (
        <main className="balance-game">
          <p role="status">로그인 상태를 확인하고 있어요.</p>
        </main>
      )}
    </>
  );
}
