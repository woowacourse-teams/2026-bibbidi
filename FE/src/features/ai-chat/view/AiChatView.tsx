import { useEffect, useId, useRef } from "react";

import bibbidiLogo from "../../../assets/bibbidi-logo.png";
import { ChatMessage, suggestedQuestions } from "../model/exampleChat";
import { RecommendedTaskCards } from "./RecommendedTaskCards";

export function ChatIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 5h14v11H9l-4 3V5Z M8 9h8 M8 12h5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function AiChatView({
  active,
  draft,
  messages,
  onChooseCard,
  onDraftChange,
  onSend,
}: {
  active: boolean;
  draft: string;
  messages: ChatMessage[];
  onChooseCard: (messageId: number, add: boolean) => void;
  onDraftChange: (value: string) => void;
  onSend: (text: string) => void;
}) {
  const logRef = useRef<HTMLDivElement>(null);
  const composing = useRef(false);
  const inputId = useId();
  useEffect(() => {
    if (!active) return;
    const scrollToEnd = () => {
      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight;
      }
    };
    scrollToEnd();
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", scrollToEnd);
    viewport?.addEventListener("scroll", scrollToEnd);
    return () => {
      viewport?.removeEventListener("resize", scrollToEnd);
      viewport?.removeEventListener("scroll", scrollToEnd);
    };
  }, [active, messages]);

  return (
    <div className="ai-chat">
      {messages.length === 0 ? (
        <div className="ai-chat__welcome">
          <span aria-hidden="true" className="ai-chat__brand-mark">
            <img alt="" draggable={false} src={bibbidiLogo} />
          </span>
          <h2>어떤 준비를 도와드릴까요?</h2>
          <p>
            원하는 준비를 말해주시면 나에게 맞는
            <br />할 일을 정리해드려요.
          </p>
          <div className="ai-chat__questions">
            {suggestedQuestions.map((question) => (
              <button
                key={question}
                onClick={() => onSend(question)}
                type="button"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div
          aria-label="AI와 나눈 대화"
          aria-live="polite"
          className="ai-chat__log"
          ref={logRef}
          role="log"
          // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- 대화 목록을 키보드로 스크롤할 수 있도록 포커스를 허용한다.
          tabIndex={0}
        >
          {messages.map((message) => (
            <div
              className={`ai-chat__message ai-chat__message--${message.role}`}
              key={message.id}
            >
              {message.role === "assistant" ? (
                <strong className="ai-chat__author">Bibbidi</strong>
              ) : null}
              <p>{message.text}</p>
              {message.role === "user" ? (
                <time>{message.time}</time>
              ) : message.kind === "guide" ? (
                <>
                  <div className="ai-chat__guide">
                    <h3>다음으로 준비하면 좋은 일</h3>
                    <ol>
                      <li>예식 형태와 입장 방식 정하기</li>
                      <li>사회자·축가·축사 맡을 사람 정하기</li>
                    </ol>
                  </div>
                  <p>원하시는 예식 분위기가 있나요?</p>
                </>
              ) : (
                <RecommendedTaskCards
                  cardIndex={message.cardIndex}
                  feedback={message.feedback}
                  onChoose={(add) => onChooseCard(message.id, add)}
                />
              )}
            </div>
          ))}
        </div>
      )}
      <form
        className="ai-chat__composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (!composing.current) onSend(draft);
        }}
      >
        <label className="ai-chat__sr-only" htmlFor={inputId}>
          추가하고 싶은 일
        </label>
        <textarea
          id={inputId}
          onChange={(event) => onDraftChange(event.target.value)}
          onCompositionEnd={() => {
            composing.current = false;
          }}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !composing.current &&
              !event.nativeEvent.isComposing &&
              event.nativeEvent.keyCode !== 229
            ) {
              event.preventDefault();
              onSend(draft);
            }
          }}
          placeholder="추가하고 싶은 일을 이야기해요"
          rows={2}
          value={draft}
        />
        <button aria-label="메시지 전송" disabled={!draft.trim()} type="submit">
          ↑
        </button>
      </form>
    </div>
  );
}
