import { Fragment, useEffect, useId, useRef } from "react";

import { AiChatFeedback } from "./AiChatFeedback";
import bibbidiLogo from "../../../assets/bibbidi-logo.webp";
import {
  ChatMessage,
  MAX_CHAT_MESSAGE_LENGTH,
  isValidChatMessage,
} from "../model/aiChat";
import { AiChatMarkdown } from "./AiChatMarkdown";
import { AiChatRecommendations } from "./AiChatRecommendations";
import { AiChatAssistantMessage } from "./AiChatAssistantMessage";
import { IconButton } from "../../../components/icon-button";
import type { ViewportMetrics } from "../../../shared/viewport";
import type { RecommendationController } from "../model/recommendation";

export function AiChatView({
  active,
  feedbackAudienceKey,
  isAuthenticated,
  draft,
  messages,
  errorMessage,
  isPending,
  onDraftChange,
  onSend,
  onRetry,
  recommendations,
  compact = false,
  onComposerFocus,
  onComposerBlur,
  viewport,
}: {
  active: boolean;
  feedbackAudienceKey?: string;
  isAuthenticated: boolean;
  draft: string;
  messages: ChatMessage[];
  errorMessage: string | null;
  isPending: boolean;
  onDraftChange: (value: string) => void;
  onSend: (text: string) => void;
  onRetry: () => void;
  recommendations: RecommendationController;
  compact?: boolean;
  onComposerFocus?: () => void;
  onComposerBlur?: () => void;
  viewport: ViewportMetrics;
}) {
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const feedbackAnchor = messages.filter(
    (message) =>
      message.role === "assistant" &&
      message.status === "complete" &&
      message.text.trim(),
  )[2]?.id;
  const logRef = useRef<HTMLDivElement>(null);
  const scrollPosition = useRef<number | undefined>(undefined);
  const lastMessages = useRef(messages);
  const lastCatalogStatus = useRef(recommendations.catalogStatus);
  const composing = useRef(false);
  const inputId = useId();
  useEffect(() => {
    if (!active) return;
    const log = logRef.current;
    if (log) {
      log.scrollTop =
        lastMessages.current !== messages ||
        scrollPosition.current === undefined ||
        (lastCatalogStatus.current !== "ready" &&
          recommendations.catalogStatus === "ready")
          ? log.scrollHeight
          : scrollPosition.current;
      scrollPosition.current = log.scrollTop;
    }
    lastMessages.current = messages;
    lastCatalogStatus.current = recommendations.catalogStatus;
  }, [active, messages, recommendations.catalogStatus]);

  const previousViewport = useRef(viewport);
  useEffect(() => {
    const changed = previousViewport.current !== viewport;
    previousViewport.current = viewport;
    if (active && changed && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
      scrollPosition.current = logRef.current.scrollTop;
    }
  }, [active, viewport]);

  return (
    <div className="ai-chat">
      {messages.length === 0 ? (
        <div className="ai-chat__welcome" hidden={compact}>
          <span aria-hidden="true" className="ai-chat__brand-mark">
            <img alt="" draggable={false} src={bibbidiLogo} />
          </span>
          <h2>어떤 준비를 도와드릴까요?</h2>
          <p>
            궁금한 준비를 말해주시면 나에게 맞는
            <br />
            안내를 드려요.
          </p>
          {!isAuthenticated && (
            <a className="ai-chat__login" href="/login">
              로그인하기
            </a>
          )}
        </div>
      ) : (
        <div
          hidden={compact}
          aria-label="AI와 나눈 대화"
          aria-busy={isPending}
          aria-live="polite"
          className="ai-chat__log"
          ref={logRef}
          onScroll={(event) => {
            if (active) scrollPosition.current = event.currentTarget.scrollTop;
          }}
          role="log"
          // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- 대화 목록을 키보드로 스크롤할 수 있도록 포커스를 허용한다.
          tabIndex={0}
        >
          {messages.map((message) => {
            const Message =
              message.role === "assistant" ? AiChatAssistantMessage : "div";
            return (
              <Fragment key={message.id}>
                <Message
                  className={
                    message.role === "user"
                      ? "ai-chat__message ai-chat__message--user"
                      : undefined
                  }
                >
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
                  {message.role === "assistant" &&
                  message.status === "complete" &&
                  Boolean(message.catalogItemIds?.length) ? (
                    <AiChatRecommendations
                      key={String(active)}
                      {...recommendations.forAnswer(
                        message.id,
                        message.catalogItemIds!,
                      )}
                      status={recommendations.catalogStatus}
                      onRetry={recommendations.retryCatalog}
                    />
                  ) : null}
                </Message>
                {isAuthenticated &&
                  feedbackAudienceKey &&
                  message.id === feedbackAnchor && (
                    <AiChatFeedback
                      key={feedbackAudienceKey}
                      audienceKey={feedbackAudienceKey}
                      onInputFocus={onComposerFocus}
                      onInputBlur={onComposerBlur}
                      onDismiss={() =>
                        composerRef.current?.focus({ preventScroll: true })
                      }
                    />
                  )}
              </Fragment>
            );
          })}
        </div>
      )}
      {isPending ? (
        <p className="ai-chat__status" role="status" hidden={compact}>
          답변을 작성하고 있어요.
        </p>
      ) : null}
      {errorMessage ? (
        <div className="ai-chat__error" role="alert" hidden={compact}>
          <p>{errorMessage}</p>
          <button onClick={onRetry} type="button">
            다시 시도
          </button>
        </div>
      ) : null}
      {compact && !isAuthenticated && (
        <button
          className="ai-chat__composer-preview"
          data-ai-composer-preview
          type="button"
          onClick={onComposerFocus}
        >
          로그인 후 AI와 대화할 수 있어요
        </button>
      )}
      <form
        hidden={compact && !isAuthenticated}
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
          ref={composerRef}
          disabled={!isAuthenticated}
          onFocus={onComposerFocus}
          onBlur={onComposerBlur}
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
          rows={compact ? 1 : 2}
          value={draft}
        />
        <div className="ai-chat__send">
          <IconButton
            aria-label="메시지 전송"
            disabled={
              !isAuthenticated || isPending || !isValidChatMessage(draft)
            }
            type="submit"
            variant="fill"
            color="var(--color-fg-on-brand)"
            bgColor="var(--color-bg-brand-solid)"
            iconSize={20}
            icon={
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 10 6-6 6 6M12 4v16" />
              </svg>
            }
          />
        </div>
      </form>
    </div>
  );
}
