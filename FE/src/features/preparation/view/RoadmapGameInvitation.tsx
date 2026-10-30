import { Link } from "react-router";
import "./RoadmapGameInvitation.css";

export function RoadmapGameInvitation() {
  return (
    <Link
      className="roadmap-game-invitation"
      to="/balance-game"
      aria-label="우리 결혼 취향 알아보기"
    >
      <span className="roadmap-game-invitation__strip" aria-hidden="true" />
      <span className="roadmap-game-invitation__copy">
        <span className="roadmap-game-invitation__title">
          우리 결혼 취향 알아보기
        </span>
        <span className="roadmap-game-invitation__description">
          둘의 취향에 맞는 준비 할 일을 찾아보세요.
        </span>
      </span>
      <span className="roadmap-game-invitation__stub" aria-hidden="true">
        <span className="roadmap-game-invitation__action">알아보기</span>
        <span className="roadmap-game-invitation__arrow">→</span>
      </span>
    </Link>
  );
}
