import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/button";
import { Dialog } from "../../components/dialog";
import { IconButton } from "../../components/icon-button";
import { ChevronLeft } from "../../components/icons/Chevron";
import { Result } from "../../components/result";
import { useBalanceGame } from "./useBalanceGame";
import { BalanceGameQuestionView } from "./view/BalanceGameQuestionView";
import { BalanceGameResults } from "./BalanceGameResults";
import "./BalanceGame.css";

export function BalanceGameFeature({
  onAuthenticationRequired,
}: {
  onAuthenticationRequired: () => void;
}) {
  const game = useBalanceGame(onAuthenticationRequired);
  const navigate = useNavigate();
  const [exitOpen, setExitOpen] = useState(false);
  const exit = () => {
    if (game.answers.length && game.state.status === "playing")
      setExitOpen(true);
    else void navigate("/preparation");
  };
  return (
    <main className="balance-game" aria-label="우리 결혼 밸런스게임">
      <nav className="balance-game__navigation" aria-label="밸런스게임 이동">
        <IconButton
          aria-label={
            game.index > 0 && game.state.status === "playing"
              ? "이전 질문"
              : "로드맵으로 돌아가기"
          }
          icon={<ChevronLeft />}
          disabled={game.submitting}
          onClick={
            game.index > 0 && game.state.status === "playing"
              ? game.previous
              : exit
          }
        />
        <span>우리 결혼 밸런스게임</span>
        <Button
          size="small"
          color="dark"
          variant="weak"
          disabled={game.submitting}
          onClick={exit}
        >
          나가기
        </Button>
      </nav>
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
            <Result.Button onClick={exit}>로드맵으로 돌아가기</Result.Button>
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
          onNext={game.next}
        />
      )}
      {game.state.status === "result" && (
        <BalanceGameResults
          items={game.state.items}
          onEdit={game.edit}
          onAuthenticationRequired={onAuthenticationRequired}
        />
      )}
      <Dialog.Confirm
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        title={<Dialog.Title>밸런스게임을 나갈까요?</Dialog.Title>}
        description={
          <Dialog.Description>
            나가면 지금 고른 답변이 사라져요.
          </Dialog.Description>
        }
        cancelButton={
          <Dialog.Confirm.CancelButton onClick={() => setExitOpen(false)}>
            계속 고르기
          </Dialog.Confirm.CancelButton>
        }
        confirmButton={
          <Dialog.Confirm.ConfirmButton
            onClick={() => void navigate("/preparation")}
          >
            나가기
          </Dialog.Confirm.ConfirmButton>
        }
      />
    </main>
  );
}
