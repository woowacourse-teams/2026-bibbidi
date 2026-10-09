export function RoadmapLoginNotice({ onShowAll }: { onShowAll: () => void }) {
  return (
    <div
      aria-label="내 로드맵"
      className="preparation-roadmap-state roadmap-login-notice"
      role="region"
    >
      <p>로그인하면 내 로드맵을 확인할 수 있어요.</p>
      <a href="/login">로그인</a>
      <button onClick={onShowAll} type="button">
        전체 단계 보기
      </button>
    </div>
  );
}
