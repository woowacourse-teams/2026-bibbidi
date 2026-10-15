import { useEffect, useId, useRef } from "react";

import bibbidiLogo from "../../../assets/bibbidi-logo.webp";
import {
  ChatMessage,
  MAX_CHAT_MESSAGE_LENGTH,
  isValidChatMessage,
  suggestedQuestions,
} from "../model/aiChat";
import { AiChatMarkdown } from "./AiChatMarkdown";

export function AiChatView({
  active,
  isAuthenticated,
  draft,
  messages,
  errorMessage,
  isPending,
  onDraftChange,
  onSend,
  onRetry,
}: {
  active: boolean;
  isAuthenticated: boolean;
  draft: string;
  messages: ChatMessage[];
  errorMessage: string | null;
  isPending: boolean;
  onDraftChange: (value: string) => void;
  onSend: (text: string) => void;
  onRetry: () => void;
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
            궁금한 준비를 말해주시면 나에게 맞는
            <br />
            안내를 드려요.
          </p>
          <div className="ai-chat__questions">
            {suggestedQuestions.map((question) => (
              <button
                disabled={!isAuthenticated}
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
          aria-busy={isPending}
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
              {message.text ? (
                message.role === "assistant" ? (
                  <AiChatMarkdown text={message.text} />
                ) : (
                  <p>{message.text}</p>
                )
              ) : null}
              {message.role === "user" ? (
                <time>{message.time}</time>
              ) : message.status === "failed" ? (
                <span className="ai-chat__incomplete">미완료 답변</span>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {isPending ? (
        <p className="ai-chat__status" role="status">
          답변을 작성하고 있어요.
        </p>
      ) : null}
      {errorMessage ? (
        <div className="ai-chat__error" role="alert">
          <p>{errorMessage}</p>
          <button onClick={onRetry} type="button">
            다시 시도
          </button>
        </div>
      ) : null}
      <form
        className="ai-chat__composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (!composing.current) onSend(draft);
        }}
      >
        <label className="ai-chat__sr-only" htmlFor={inputId}>
          AI에게 보낼 메시지
        </label>
        <textarea
          disabled={!isAuthenticated}
          id={inputId}
          maxLength={MAX_CHAT_MESSAGE_LENGTH}
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
          placeholder={
            isAuthenticated
              ? "궁금한 준비를 이야기해요"
              : "로그인 후 AI와 대화할 수 있어요"
          }
          rows={2}
          value={draft}
        />
        <button
          aria-label="메시지 전송"
          disabled={!isAuthenticated || isPending || !isValidChatMessage(draft)}
          type="submit"
        >
          ↑
        </button>
      </form>
    </div>
  );
}
