import {
  useHref,
  useLinkClickHandler,
} from "../../../app/navigation/navigation";
import { useLoginModal } from "../../auth/useLoginModal";
import { Fragment, useEffect, useLayoutEffect, useId, useRef } from "react";

import { AiChatFeedback } from "./AiChatFeedback";
import {
  ChatMessage,
  MAX_CHAT_MESSAGE_LENGTH,
  isValidChatMessage,
} from "../model/aiChat";
import { AiChatMarkdown } from "./AiChatMarkdown";
import { AiChatRecommendations } from "./AiChatRecommendations";
import { AiChatAssistantMessage } from "./AiChatAssistantMessage";
import { Button } from "../../../components/button";
import { IconButton } from "../../../components/icon-button";
import type { ViewportMetrics } from "../../../shared/viewport";
import type { RecommendationController } from "../model/recommendation";

export function AiChatView({
  active,
  feedbackAudienceKey,
  feedbackAfterMessageId,
  isAuthenticated,
  draft,
  messages,
  errorMessage,
  isPending,
  onDraftChange,
  onSend,
  onRetry,
  recommendations,
  onComposerFocus,
  onComposerBlur,
  viewport,
}: {
  active: boolean;
  feedbackAudienceKey?: string;
  feedbackAfterMessageId?: number;
  isAuthenticated: boolean;
  draft: string;
  messages: ChatMessage[];
  errorMessage: string | null;
  isPending: boolean;
  onDraftChange: (value: string) => void;
  onSend: (text: string) => void;
  onRetry: () => void;
  recommendations: RecommendationController;
  onComposerFocus?: () => void;
  onComposerBlur?: () => void;
  viewport: ViewportMetrics;
}) {
  const { loginTo, loginState } = useLoginModal();
  const loginHref = useHref(loginTo);
  const navigateToLogin = useLinkClickHandler<HTMLAnchorElement>(loginTo, {
    state: loginState,
    preventScrollReset: true,
  });
  const inputId = useId();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const scrollPosition = useRef<number | undefined>(undefined);
  const lastMessages = useRef(messages);
  const lastCatalogStatus = useRef(recommendations.catalogStatus);
  const composing = useRef(false);
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

  useLayoutEffect(() => {
    const input = composerRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  }, [draft, isAuthenticated, viewport.layoutWidth]);

  return (
    <div className="ai-chat" data-empty={messages.length === 0 || undefined}>
      {messages.length === 0 ? (
        <div className="ai-chat__welcome">
          <h2>어떤 준비를 도와드릴까요?</h2>
        </div>
      ) : (
        <div
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
                  message.id === feedbackAfterMessageId && (
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
        <p className="ai-chat__status" role="status">
          답변을 작성하고 있어요.
        </p>
      ) : null}
      {errorMessage ? (
        <div className="ai-chat__error" role="alert">
          <p>{errorMessage}</p>
          <Button size="small" variant="weak" onClick={onRetry}>
            다시 시도
          </Button>
        </div>
      ) : null}
      <div className="ai-chat__composer-area">
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
            id={inputId}
            className="ai-chat__input"
            ref={composerRef}
            disabled={!isAuthenticated}
            onFocus={onComposerFocus}
            onBlur={onComposerBlur}
            maxLength={MAX_CHAT_MESSAGE_LENGTH}
            onChange={(event) => onDraftChange(event.target.value)}
            onCompositionEnd={() => {
              composing.current = false;
            }}
            onCompositionStart={() => {
              composing.current = true;
            }}
            placeholder={
              isAuthenticated
                ? "궁금한 준비를 이야기해요"
                : "로그인 후 AI와 대화할 수 있어요"
            }
            rows={1}
            value={draft}
          />
          <IconButton
            aria-label="메시지 전송"
            variant="fill"
            color="var(--color-fg-on-brand)"
            bgColor="var(--color-bg-brand-solid)"
            iconSize={20}
            disabled={
              !isAuthenticated || isPending || !isValidChatMessage(draft)
            }
            type="submit"
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
        </form>
        {!isAuthenticated && (
          <div className="ai-chat__login-prompt">
            <a href={loginHref} onClick={navigateToLogin}>
              로그인하기
            </a>
          </div>
        )}
        <p className="ai-chat__notice">
          AI의 답변은 참고용이에요. 중요한 내용은 한 번 더 확인해요.
        </p>
      </div>
    </div>
  );
}
