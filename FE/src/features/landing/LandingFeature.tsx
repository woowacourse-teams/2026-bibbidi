import "./Landing.css";

export function LandingFeature() {
  return (
    <main className="landing-page" aria-label="비비디 서비스 소개">
      <iframe
        className="landing-page-frame"
        title="비비디 서비스 소개와 사용 예시"
        src="/landing-story/index.html"
      />
    </main>
  );
}
