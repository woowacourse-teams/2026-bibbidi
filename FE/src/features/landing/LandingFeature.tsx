import { useState } from "react";
import { Link } from "react-router";

import { BibidiBrand } from "../../components/BibidiBrand/BibidiBrand";
import calendarScreen from "./assets/calendar.jpg";
import checklistScreen from "./assets/checklist.jpg";
import { useLandingMotion } from "./useLandingMotion";
import { LandingAiChatScene } from "./LandingAiChatScene";
import { LandingHeroExperience } from "./LandingHeroExperience";
import "./Landing.css";

const features = [
  {
    label: "AI",
    title: ["궁금한 것부터,", "편하게 물어보세요."],
    description: [
      "무엇부터 해야 할지 모르겠다면,",
      "내 상황을 이야기하고 준비 방향을 찾아요.",
    ],
    step: "AI에게 질문",
  },
  {
    label: "체크리스트",
    title: ["필요한 준비만,", "하나씩 끝내요."],
    description: [
      "우리에게 필요한 일을 한곳에 담고,",
      "지금 어디까지 준비했는지 확인해요.",
    ],
    step: "체크리스트",
    image: checklistScreen,
    alt: "비비디 체크리스트 화면. 웨딩홀 투어와 계약 등 준비 항목과 상태를 확인합니다.",
  },
  {
    label: "캘린더",
    title: ["해야 할 일이,", "예정된 하루가 되도록."],
    description: [
      "날짜와 장소를 정하고,",
      "다가오는 준비 일정을 한눈에 확인해요.",
    ],
    step: "캘린더",
    image: calendarScreen,
    alt: "비비디 캘린더 화면. 월간 달력과 날짜를 정할 준비 항목을 확인합니다.",
  },
];

const roadmapSteps = [
  {
    title: ["AI에게", "물어보고"],
    description: "내 상황을 이야기하고, AI와 준비 방향을 찾아요.",
    icon: "chat",
  },
  {
    title: ["준비할 일을", "발견하고"],
    description: "로드맵에서 단계별 준비 항목을 살펴봐요.",
    icon: "list",
  },
  {
    title: ["나의 목록에", "담고"],
    description: "우리에게 필요한 준비만 체크리스트에 모아요.",
    icon: "heart",
  },
  {
    title: ["예정된 하루로", "만들어요"],
    description: "날짜와 장소를 정하고 캘린더에서 확인해요.",
    icon: "calendar",
  },
];

export function LandingFeature() {
  const [chatReplay, setChatReplay] = useState(0);
  const {
    rootRef,
    featureRef,
    activeStep,
    motionDisabled,
    reducedMotion,
    selectStep,
    toggleMotion,
  } = useLandingMotion();
  const activeFeature = features[activeStep];

  return (
    <div
      className={`landing-page landing-enhanced${motionDisabled ? " landing-motion-off" : ""}`}
      ref={rootRef}
    >
      <nav className="landing-nav" aria-label="랜딩 메뉴">
        <div className="landing-nav-inner">
          <a
            className="landing-brand"
            href="#landing-home"
            aria-label="비비디 랜딩 처음으로"
          >
            <BibidiBrand />
          </a>
          <div className="landing-nav-links">
            <a className="landing-desktop-only" href="#landing-experience">
              서비스 소개
            </a>
            <a className="landing-desktop-only" href="#landing-roadmap">
              준비 로드맵
            </a>
            <Link className="landing-desktop-only" to="/login">
              로그인
            </Link>
            <Link className="landing-button" to="/preparation">
              준비 시작하기 <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </nav>
      <button
        className="landing-motion-toggle"
        type="button"
        aria-pressed={motionDisabled}
        disabled={reducedMotion}
        onClick={toggleMotion}
      >
        {reducedMotion
          ? "기기 설정: 움직임 최소화"
          : motionDisabled
            ? "움직임 켜기"
            : "움직임 끄기"}
      </button>
      <main aria-label="비비디 서비스 소개">
        <section
          className="landing-hero"
          id="landing-home"
          aria-labelledby="landing-hero-title"
        >
          <div className="landing-hero-copy landing-hero-entry">
            <p className="landing-eyebrow">BIBBIDI FOR YOUR BIG DAY</p>
            <h1 id="landing-hero-title">
              결혼 준비,
              <br />
              <span>비비디와 하나씩.</span>
            </h1>
            <p className="landing-hero-sub">
              AI에게 물어보고, 필요한 준비를 골라요.
              <br />
              체크리스트부터 일정까지 한곳에서 정리해요.
            </p>
            <div className="landing-hero-actions">
              <Link className="landing-button" to="/preparation">
                준비 시작하기 <span aria-hidden="true">↗</span>
              </Link>
              <a
                className="landing-button landing-light"
                href="#landing-experience"
              >
                서비스 살펴보기 <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>
          <LandingHeroExperience motionDisabled={motionDisabled} />
          <p className="landing-scroll-hint" aria-hidden="true">
            SCROLL TO EXPLORE<span>↓</span>
          </p>
        </section>
        <section
          className="landing-intro"
          aria-labelledby="landing-intro-title"
        >
          <h2 id="landing-intro-title">
            <span>처음이라 막막한 준비.</span>
            <span>검색할수록 늘어나는 질문.</span>
            <span>이제, 하나씩 정리해요.</span>
          </h2>
          <p data-reveal>
            준비의 방향을 찾는 순간부터
            <br />
            하나의 일정을 마치는 순간까지.
          </p>
        </section>
        <section
          className="landing-feature-scroll"
          id="landing-experience"
          ref={featureRef}
          aria-label="비비디 기능 소개"
        >
          <div className="landing-feature-pin">
            <div className="landing-feature-copy">
              <div key={activeFeature.label} className="landing-copy-change">
                <p className="landing-feature-label">{activeFeature.label}</p>
                <h2>
                  {activeFeature.title[0]}
                  <br />
                  {activeFeature.title[1]}
                </h2>
                <p className="landing-feature-description">
                  {activeFeature.description[0]}
                  <br />
                  {activeFeature.description[1]}
                </p>
              </div>
              <div className="landing-steps" aria-label="소개할 기능 선택">
                {features.map((feature, index) => (
                  <button
                    className="landing-step"
                    type="button"
                    key={feature.label}
                    aria-pressed={activeStep === index}
                    onClick={() => selectStep(index)}
                  >
                    <b>{String(index + 1).padStart(2, "0")}</b>
                    {feature.step}
                    <span className="landing-step-arrow" aria-hidden="true">
                      →
                    </span>
                  </button>
                ))}
              </div>
              <p className="landing-preview-note">
                실제 서비스 화면 · AI 대화와 추천 카드는 예시입니다.
              </p>
              <div className="landing-chat-replay-slot">
                {activeStep === 0 && !motionDisabled ? (
                  <button
                    className="landing-chat-replay"
                    type="button"
                    onClick={() => setChatReplay((value) => value + 1)}
                  >
                    대화 연출 다시 보기 <span aria-hidden="true">↻</span>
                  </button>
                ) : null}
              </div>
            </div>
            <div className="landing-feature-visual">
              <div
                className="landing-phone landing-feature-phone"
                data-stage={activeStep}
              >
                {features.map((feature, index) => (
                  <div
                    key={feature.label}
                    className={`landing-screen-panel${activeStep === index ? " landing-active" : ""}`}
                    aria-hidden={activeStep !== index}
                  >
                    {index === 0 ? (
                      <LandingAiChatScene
                        key={chatReplay}
                        active={activeStep === 0}
                        motionDisabled={motionDisabled}
                      />
                    ) : (
                      <img
                        className="landing-phone-image"
                        src={feature.image}
                        width="390"
                        height="844"
                        alt={feature.alt}
                        loading="lazy"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="landing-phase-meter" aria-hidden="true">
              <span>{String(activeStep + 1).padStart(2, "0")}</span>
              <div className="landing-track">
                <span />
              </div>
              <span>03</span>
            </div>
          </div>
        </section>
        <section
          className="landing-roadmap"
          id="landing-roadmap"
          aria-labelledby="landing-roadmap-title"
        >
          <div data-reveal>
            <p className="landing-feature-label">준비 로드맵</p>
            <h2 id="landing-roadmap-title">
              처음부터 만들 필요 없이,
              <br />
              필요한 준비를 골라요.
            </h2>
          </div>
          <p data-reveal>
            궁금한 건 AI에게 물어보고, 필요한 준비를 골라보세요.
            <br />
            질문부터 준비 목록과 일정까지 한 흐름으로 이어져요.
          </p>
          <div className="landing-roadmap-cards">
            {roadmapSteps.map((step, index) => (
              <article
                className={`landing-roadmap-card landing-roadmap-${step.icon}`}
                data-reveal
                key={step.icon}
              >
                <small>STEP {String(index + 1).padStart(2, "0")}</small>
                <h3>
                  {step.title[0]}
                  <br />
                  {step.title[1]}
                </h3>
                <p>{step.description}</p>
                <div
                  className={`landing-roadmap-icon landing-icon-${step.icon}`}
                  aria-hidden="true"
                >
                  {step.icon === "list" || step.icon === "chat" ? (
                    <>
                      <i />
                      <i />
                      <i />
                    </>
                  ) : step.icon === "heart" ? (
                    "♥"
                  ) : (
                    "18"
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
        <section
          className="landing-final"
          aria-labelledby="landing-final-title"
        >
          <div data-reveal>
            <p className="landing-eyebrow">LESS WORRY, MORE LOVE</p>
            <h2 id="landing-final-title">
              준비의 끝에는,
              <br />
              우리의 시작이.
            </h2>
            <p>궁금한 것부터, 비비디와 하나씩.</p>
            <Link className="landing-button" to="/preparation">
              우리 준비 시작하기 <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <a
          className="landing-brand"
          href="#landing-home"
          aria-label="비비디 랜딩 처음으로"
        >
          <BibidiBrand />
        </a>
        <p>
          우리의 결혼 준비, 비비디에서 하나씩.
          <br />
          소개 이미지는 서비스 화면 캡처이며, AI 대화는 예시입니다.
        </p>
      </footer>
    </div>
  );
}
