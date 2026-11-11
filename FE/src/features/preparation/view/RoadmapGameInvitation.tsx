import { Link } from "../../../app/navigation/navigation";
import "./RoadmapGameInvitation.css";

export function RoadmapGameInvitation() {
  return (
    <Link
      className="roadmap-game-invitation"
      to="/balance-game"
      aria-label="어디서부터 준비할지 막막한가요?"
    >
      <span className="roadmap-game-invitation__strip" aria-hidden="true" />
      <span className="roadmap-game-invitation__copy">
        <span className="roadmap-game-invitation__title">
          어디서부터 준비할지 막막한가요?
        </span>
        <span className="roadmap-game-invitation__description">
          간단한 테스트로 체크리스트를 추천받아 보세요
        </span>
      </span>
      <span className="roadmap-game-invitation__stub" aria-hidden="true">
        <span className="roadmap-game-invitation__action">알아보기</span>
        <span className="roadmap-game-invitation__arrow">→</span>
      </span>
    </Link>
  );
}
