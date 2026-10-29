import { useCallback, useState } from "react";
import { readBalanceGameDraft } from "./model/balanceGameDraft";
import { useNavigate } from "react-router";
import { Result } from "../../components/result";
import { useBalanceGame } from "./useBalanceGame";
import { BalanceGameQuestionView } from "./view/BalanceGameQuestionView";
import { BalanceGameResults } from "./BalanceGameResults";
import "./BalanceGame.css";

export function BalanceGameFeature({
  onAuthenticationRequired,
  onLoginRequired,
  audience = "authenticated",
}: {
  onAuthenticationRequired: () => void;
  onLoginRequired?: () => void;
  audience?: "guest" | "authenticated";
}) {
  const [draft] = useState(readBalanceGameDraft);
  const game = useBalanceGame(audience, draft);
  const navigate = useNavigate();
  const rememberForLogin = game.rememberForLogin;
  const handleAuthenticationRequired = useCallback(
    (ids: number[]) => {
      rememberForLogin(ids);
      onAuthenticationRequired();
    },
    [rememberForLogin, onAuthenticationRequired],
  );
  return (
    <main className="balance-game" aria-label="우리 결혼 밸런스게임">
      {game.state.status === "loading" && (
        <p className="balance-game__status" role="status">
          질문을 불러오고 있어요.
        </p>
      )}
      {game.state.status === "error" && (
        <Result
          title="질문을 불러오지 못했어요"
          description={<p role="alert">{game.state.message}</p>}
          button={<Result.Button onClick={game.retry}>다시 시도</Result.Button>}
        />
      )}
      {game.state.status === "empty" && (
        <Result
          title="질문이 없어요"
          button={
            <Result.Button onClick={() => void navigate("/preparation")}>
              로드맵으로 돌아가기
            </Result.Button>
          }
        />
      )}
      {game.state.status === "playing" && game.question && (
        <BalanceGameQuestionView
          question={game.question}
          index={game.index}
          total={game.state.questions.length}
          selected={game.selected}
          submitting={game.submitting}
          error={game.error}
          onSelect={game.select}
          onPrevious={game.previous}
          onNext={game.next}
        />
      )}
      {game.state.status === "result" && (
        <BalanceGameResults
          result={game.state.result}
          audience={audience}
          tracking={game.tracking}
          requestDurationMs={game.state.requestDurationMs}
          resultInstanceId={game.state.instanceId}
          initialSelection={game.state.selectedIds}
          onLoginRequired={(ids) => {
            if (!game.rememberForLogin(ids)) return false;
            game.tracking.emit("balance_game_login_click");
            onLoginRequired?.();
            return true;
          }}
          onEdit={game.edit}
          onAuthenticationRequired={handleAuthenticationRequired}
        />
      )}
    </main>
  );
}
