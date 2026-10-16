import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";

import roadmapScreen from "./assets/roadmap.jpg";
import { LandingAiChatScene } from "./LandingAiChatScene";
import { landingChatExamples } from "./landingExamples";
import "./LandingHeroExperience.css";

const tabs = [
  { id: "roadmap", label: "로드맵" },
  { id: "ai", label: "AI 질문" },
  { id: "checklist", label: "체크리스트" },
  { id: "calendar", label: "캘린더" },
] as const;
type DemoTab = (typeof tabs)[number]["id"];

const demoTasks = [
  "웨딩홀 투어 예약하기",
  "예식 진행 순서 정하기",
  "사회자·축가 맡을 사람 정하기",
];
const demoSchedules: Record<number, { title: string; time: string }> = {
  18: { title: "웨딩홀 투어", time: "11:00" },
  23: { title: "촬영 의상 피팅", time: "14:00" },
  29: { title: "예식 진행 순서 상의", time: "19:00" },
};

export function LandingHeroExperience({
  motionDisabled,
}: {
  motionDisabled: boolean;
}) {
  const artRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<DemoTab>("roadmap");
  const [questionIndex, setQuestionIndex] = useState<number | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(18);
  const [feedback, setFeedback] = useState(
    "카드나 아래 탭을 눌러 체험해보세요.",
  );
  const schedule = demoSchedules[selectedDate];

  useEffect(() => {
    if (tab !== "ai") return;
    artRef.current
      ?.querySelector<HTMLButtonElement>(
        questionIndex === null
          ? ".landing-demo-question"
          : ".landing-demo-question-again",
      )
      ?.focus({ preventScroll: true });
  }, [tab, questionIndex]);

  function selectTab(next: DemoTab) {
    setTab(next);
    setFeedback(
      next === "ai"
        ? questionIndex === null
          ? "궁금한 질문을 골라 AI 대화를 시작해보세요."
          : "AI의 예시 답변과 추천 카드를 확인해보세요."
        : next === "checklist"
          ? "할 일을 눌러 완료해보세요."
          : next === "calendar"
            ? "날짜를 눌러 예시 일정을 확인해보세요."
            : "실제 서비스의 준비 로드맵 화면이에요.",
    );
  }

  function movePointer(event: PointerEvent<HTMLDivElement>) {
    if (motionDisabled || event.pointerType !== "mouse") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    event.currentTarget.style.setProperty("--hero-pointer-x", String(x));
    event.currentTarget.style.setProperty("--hero-pointer-y", String(y));
  }

  function resetPointer() {
    artRef.current?.style.removeProperty("--hero-pointer-x");
    artRef.current?.style.removeProperty("--hero-pointer-y");
  }

  function toggleTask(task: string) {
    const wasCompleted = completed.includes(task);
    setCompleted((previous) =>
      wasCompleted
        ? previous.filter((item) => item !== task)
        : [...previous, task],
    );
    setFeedback(
      `${task}${wasCompleted ? " 완료를 취소했어요." : " 완료했어요!"}`,
    );
  }

  return (
    <section className="landing-hero-experience" aria-label="비비디 기능 체험">
      <div
        ref={artRef}
        className="landing-hero-art landing-hero-entry"
        onPointerMove={movePointer}
        onPointerLeave={resetPointer}
      >
        <div className="landing-hero-glow" aria-hidden="true" />
        <div className="landing-hero-device-tilt">
          <div className="landing-phone landing-hero-phone">
            <div key={tab} className="landing-hero-demo-screen">
              {tab === "roadmap" ? (
                <img
                  className="landing-phone-image"
                  src={roadmapScreen}
                  width="390"
                  height="844"
                  alt="비비디의 실제 모바일 준비 로드맵 화면. 웨딩홀 관련 준비 단계를 살펴봅니다."
                />
              ) : tab === "ai" ? (
                questionIndex === null ? (
                  <div className="landing-demo-page">
                    <DemoHeader title="AI 채팅" />
                    <div className="landing-demo-ai-welcome">
                      <span className="landing-demo-spark" aria-hidden="true">
                        ✧
                      </span>
                      <h3>
                        어떤 준비가
                        <br />
                        궁금하세요?
                      </h3>
                      <p>
                        질문을 고르면 비비디가
                        <br />
                        준비할 일을 함께 찾아요.
                      </p>
                      {landingChatExamples.map((example, index) => (
                        <button
                          key={example.question}
                          type="button"
                          className="landing-demo-question"
                          onClick={() => {
                            setQuestionIndex(index);
                            setFeedback(
                              "선택한 질문의 예시 답변과 추천 카드를 보여드려요.",
                            );
                          }}
                        >
                          {example.question}
                          <span aria-hidden="true">↗</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <LandingAiChatScene
                    key={questionIndex}
                    active
                    motionDisabled={motionDisabled}
                    questionIndex={questionIndex}
                    onChooseAgain={() => {
                      setQuestionIndex(null);
                      setFeedback("다른 질문도 골라보세요.");
                    }}
                  />
                )
              ) : tab === "checklist" ? (
                <div className="landing-demo-page">
                  <DemoHeader title="나의 체크리스트" />
                  <div className="landing-demo-content">
                    <p className="landing-demo-eyebrow">우리의 준비 현황</p>
                    <h3>
                      하나씩 끝내면,
                      <br />
                      그만큼 가벼워져요.
                    </h3>
                    <div className="landing-demo-progress-copy">
                      <strong>
                        {completed.length} / {demoTasks.length} 완료
                      </strong>
                      <span>
                        {Math.round(
                          (completed.length / demoTasks.length) * 100,
                        )}
                        %
                      </span>
                    </div>
                    <progress
                      aria-label="예시 준비 진행도"
                      value={completed.length}
                      max={demoTasks.length}
                    />
                    <div className="landing-demo-tasks">
                      {demoTasks.map((task) => (
                        <label
                          key={task}
                          className={`landing-demo-task${completed.includes(task) ? " landing-demo-completed" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={completed.includes(task)}
                            onChange={() => toggleTask(task)}
                          />
                          <span
                            className="landing-demo-check"
                            aria-hidden="true"
                          >
                            {completed.includes(task) ? "✓" : ""}
                          </span>
                          <span>{task}</span>
                        </label>
                      ))}
                    </div>
                    <p className="landing-demo-tip">
                      {completed.length === demoTasks.length
                        ? "준비 완료! 오늘도 한 걸음 가까워졌어요."
                        : "할 일을 눌러 체크해보세요."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="landing-demo-page">
                  <DemoHeader title="우리의 캘린더" />
                  <div className="landing-demo-content landing-demo-calendar">
                    <p className="landing-demo-eyebrow">함께 준비하는 하루</p>
                    <h3>2026년 10월</h3>
                    <div className="landing-demo-week" aria-hidden="true">
                      {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                        <span key={day}>{day}</span>
                      ))}
                    </div>
                    <div
                      className="landing-demo-dates"
                      aria-label="10월 예시 일정 날짜 선택"
                    >
                      {Array.from({ length: 4 }, (_, index) => (
                        <span key={`blank-${index}`} aria-hidden="true" />
                      ))}
                      {Array.from({ length: 31 }, (_, index) => index + 1).map(
                        (day) => (
                          <button
                            key={day}
                            type="button"
                            aria-label={`10월 ${day}일${demoSchedules[day] ? `, ${demoSchedules[day].title} 일정` : ""}`}
                            aria-pressed={day === selectedDate}
                            className={
                              demoSchedules[day] ? "landing-demo-has-event" : ""
                            }
                            onClick={() => {
                              setSelectedDate(day);
                              setFeedback(
                                `10월 ${day}일: ${demoSchedules[day]?.title ?? "등록된 예시 일정이 없어요."}`,
                              );
                            }}
                          >
                            {day}
                          </button>
                        ),
                      )}
                    </div>
                    <div className="landing-demo-agenda">
                      <small>10월 {selectedDate}일</small>
                      <strong>
                        {schedule?.title ?? "등록된 예시 일정이 없어요."}
                      </strong>
                      <p>
                        {schedule
                          ? `${schedule.time} · 예시 일정`
                          : "점이 있는 날짜도 눌러보세요."}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="landing-float-card landing-float-left"
          aria-label="나의 체크리스트 체험하기"
          aria-pressed={tab === "checklist"}
          onClick={() => selectTab("checklist")}
        >
          <small>나의 체크리스트</small>
          <strong>준비할 일, 한곳에</strong>
          <p>눌러서 할 일을 완료해보세요.</p>
          <span className="landing-demo-card-arrow" aria-hidden="true">
            ↗
          </span>
        </button>
        <button
          type="button"
          className="landing-float-card landing-float-right"
          aria-label="비비디 AI 체험하기"
          aria-pressed={tab === "ai"}
          onClick={() => selectTab("ai")}
        >
          <span className="landing-float-icon" aria-hidden="true">
            ✧
          </span>
          <small>비비디 AI</small>
          <strong>어떤 준비가 궁금하세요?</strong>
          <p>눌러서 AI와 대화해보세요.</p>
          <span className="landing-demo-card-arrow" aria-hidden="true">
            ↗
          </span>
        </button>
      </div>
      <div className="landing-hero-demo-controls">
        <div className="landing-hero-demo-tabs" aria-label="체험할 기능 선택">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={tab === item.id}
              onClick={() => selectTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="landing-hero-demo-feedback" role="status">
          {feedback}
        </p>
        <div className="landing-hero-demo-note">
          <span>서비스 화면을 바탕으로 만든 예시 체험이에요.</span>
          <button
            type="button"
            onClick={() => {
              setCompleted([]);
              setQuestionIndex(null);
              setSelectedDate(18);
              setFeedback("예시 체험을 처음 상태로 돌렸어요.");
            }}
          >
            체험 초기화 <span aria-hidden="true">↻</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function DemoHeader({ title }: { title: string }) {
  return (
    <div className="landing-demo-header">
      <strong>{title}</strong>
      <small>예시 체험</small>
    </div>
  );
}
