import { Link } from "react-router";
import "./RoadmapGameInvitation.css";

export function RoadmapGameInvitation() {
  return (
    <Link
      className="roadmap-game-invitation"
      to="/balance-game"
      aria-label="우리 결혼 밸런스 게임 초대장 열기"
    >
      <span className="roadmap-game-invitation__strip" aria-hidden="true" />
      <span className="roadmap-game-invitation__copy">
        <span className="roadmap-game-invitation__eyebrow" aria-hidden="true">
          YOU’RE INVITED
        </span>
        <span className="roadmap-game-invitation__title">밸런스 게임</span>
      </span>
      <span className="roadmap-game-invitation__stub" aria-hidden="true">
        →
      </span>
    </Link>
  );
}
