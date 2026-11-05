import { useEffect, useRef, useState } from "react";

import { landingChatExamples } from "./landingExamples";
import "./LandingAiChatScene.css";

export function LandingAiChatScene({
  active,
  motionDisabled,
  questionIndex = 0,
  onChooseAgain,
}: {
  active: boolean;
  motionDisabled: boolean;
  questionIndex?: number;
  onChooseAgain?: () => void;
}) {
  const example = landingChatExamples[questionIndex] ?? landingChatExamples[0];
  const sceneRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(
    () => typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.4 },
    );
    observer.observe(scene);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sceneRef}
      aria-label="AI 대화와 추천 카드 예시"
      className={`landing-chat-scene${motionDisabled ? "" : " landing-chat-animated"}${active && inView ? " landing-chat-playing" : ""}`}
    >
      <div className="landing-chat-header">
        <span aria-hidden="true">‹</span>
        <strong>
          AI 채팅 <small>예시</small>
        </strong>
        <span aria-hidden="true">×</span>
      </div>
      <div className="landing-chat-conversation">
        <div className="landing-chat-question" data-chat-reveal>
          <p>{example.question}</p>
          <span>9:41</span>
        </div>
        <div className="landing-chat-typing" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="landing-chat-reply" data-chat-reveal>
          <strong>Bibbidi</strong>
          <p>
            {example.reply[0]}
            <br />
            {example.reply[1]}
          </p>
        </div>
        <div className="landing-chat-recommendations" data-chat-reveal>
          <p className="landing-chat-card-heading">
            다음으로 준비하면 좋은 일 <span>2개</span>
          </p>
          {example.tasks.map((task, index) => (
            <article
              key={task.title}
              className="landing-chat-task-card"
              data-chat-reveal
            >
              <span className="landing-chat-card-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{task.title}</h3>
              <p>{task.step}</p>
              <span className="landing-chat-card-tag">
                추천 할 일 <span aria-hidden="true">↗</span>
              </span>
            </article>
          ))}
        </div>
      </div>
      {onChooseAgain ? (
        <button
          className="landing-demo-question-again"
          type="button"
          onClick={onChooseAgain}
        >
          다른 질문 해보기 <span aria-hidden="true">↻</span>
        </button>
      ) : (
        <div className="landing-chat-composer" aria-hidden="true">
          <span>추가하고 싶은 일을 이야기해요</span>
          <span className="landing-chat-send">↑</span>
        </div>
      )}
    </section>
  );
}
