import { useLayoutEffect, useState } from "react";
import { useLinkClickHandler } from "react-router";

import { PageContainer } from "../../components/page-container";
import { Button } from "../../components/button";
import { useIsMobileLayout } from "../../shared/responsive";
import { useViewportMetrics, viewportStyles } from "../../shared/viewport";
import { useAiChatSession } from "./AiChatSession";
import { useAiChatKeyboard } from "./hooks/useAiChatKeyboard";
import { getAiChatFeedbackAnchor } from "./model/aiChatFeedback";
import { AiChatView } from "./view/AiChatView";
import "./view/AiChat.css";
import "./view/AiChatPage.css";

export function AiChatFeature() {
  const session = useAiChatSession();
  const isMobile = useIsMobileLayout();
  const [editing, setEditing] = useState(false);
  const viewport = useViewportMetrics(true);
  const keyboardOpen = useAiChatKeyboard(viewport, isMobile && editing);
  const { onKeyboardVisibilityChange } = session;
  useLayoutEffect(() => {
    onKeyboardVisibilityChange?.(keyboardOpen);
    return () => onKeyboardVisibilityChange?.(false);
  }, [keyboardOpen, onKeyboardVisibilityChange]);

  const { isAuthenticated, addedTask, checklistRefresh } = session;
  const addedTaskTarget = addedTask?.taskId
    ? `/checklist?taskId=${encodeURIComponent(addedTask.taskId)}`
    : "/checklist";
  const navigateToAddedTask =
    useLinkClickHandler<HTMLAnchorElement>(addedTaskTarget);
  return (
    <main
      className="ai-chat-page"
      aria-label="AI 챗"
      data-keyboard-open={keyboardOpen || undefined}
      style={viewportStyles(viewport, "ai-page")}
    >
      <PageContainer width="content" className="ai-chat-page__content">
        <h1 className="ai-chat__sr-only">AI 챗</h1>
        <AiChatView
          active
          viewport={viewport}
          isAuthenticated={isAuthenticated}
          feedbackAudienceKey={session.feedbackAudienceKey}
          feedbackAfterMessageId={getAiChatFeedbackAnchor(session.messages)}
          draft={isAuthenticated ? session.draft : ""}
          messages={isAuthenticated ? session.messages : []}
          errorMessage={session.errorMessage}
          isPending={session.isPending}
          recommendations={session.recommendations}
          onDraftChange={(text) => {
            if (isAuthenticated) session.setDraft(text);
          }}
          onSend={(text) => {
            if (isAuthenticated) session.send(text);
          }}
          onRetry={session.retry}
          onComposerFocus={() => setEditing(true)}
          onComposerBlur={() => setEditing(false)}
        />
        {checklistRefresh.error && (
          <div className="ai-chat-page__result">
            <p role="alert">{checklistRefresh.error}</p>
            <Button
              size="small"
              variant="weak"
              loading={checklistRefresh.refreshing}
              onClick={checklistRefresh.refresh}
            >
              체크리스트 다시 불러오기
            </Button>
          </div>
        )}
        {addedTask && (
          <div className="ai-chat-page__result">
            <p role="status">{addedTask.title}</p>
            <Button.Link
              size="small"
              variant="weak"
              href={addedTaskTarget}
              onClick={navigateToAddedTask}
            >
              추가한 일 보기
            </Button.Link>
          </div>
        )}
      </PageContainer>
    </main>
  );
}
