import { RefObject, useRef, useState, useEffect, useLayoutEffect } from "react";

import { useAiChatConversation } from "./hooks/useAiChatConversation";
import { useAiChatRecommendations } from "./hooks/useAiChatRecommendations";
import { GlobalAiChatDialog } from "./view/GlobalAiChatDialog";
import { Button } from "../../components/button";
import { useLinkClickHandler } from "react-router";
import { useMyChecklistQueryRepository } from "../checklist";
import { getAiChatFeedbackAnchor } from "./model/aiChatFeedback";
import { AiChatView } from "./view/AiChatView";
import { useIsMobileLayout } from "../../shared/responsive";
import {
  useViewportMetrics,
  type ViewportMetrics,
} from "../../shared/viewport";
import { useAiChatKeyboard } from "./hooks/useAiChatKeyboard";
import type { RecommendationController } from "./model/recommendation";

function GuestAiChatView({
  active,
  recommendations,
  compact,
  onComposerFocus,
  viewport,
}: {
  active: boolean;
  recommendations: RecommendationController;
  compact: boolean;
  onComposerFocus: () => void;
  viewport: ViewportMetrics;
}) {
  return (
    <AiChatView
      active={active}
      viewport={viewport}
      isAuthenticated={false}
      compact={compact}
      onComposerFocus={onComposerFocus}
      draft=""
      messages={[]}
      errorMessage={null}
      isPending={false}
      recommendations={recommendations}
      onDraftChange={() => {}}
      onRetry={() => {}}
      onSend={() => {}}
    />
  );
}

function AddedTaskLink({
  taskId,
  onClose,
}: {
  taskId?: string;
  onClose: () => void;
}) {
  const target = taskId
    ? `/checklist?taskId=${encodeURIComponent(taskId)}`
    : "/checklist";
  const navigate = useLinkClickHandler<HTMLAnchorElement>(target);
  return (
    <Button.Link
      size="small"
      variant="weak"
      href={target}
      onClick={(event) => {
        const plainClick =
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey;
        navigate(event);
        if (plainClick) onClose();
      }}
    >
      추가한 일 보기
    </Button.Link>
  );
}

export function AiChatSession({
  isAuthenticated,
  feedbackAudienceKey,
  isOpen,
  onAuthenticationRequired,
  onClose,
  returnFocusRef,
  contextLabel,
  onKeyboardVisibilityChange,
}: {
  isAuthenticated: boolean;
  feedbackAudienceKey: string;
  isOpen: boolean;
  onAuthenticationRequired: () => void;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  contextLabel?: string;
  onKeyboardVisibilityChange?: (visible: boolean) => void;
}) {
  const isMobile = useIsMobileLayout();
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  if (!isOpen && editing) setEditing(false);
  const viewport = useViewportMetrics(isOpen);
  const keyboardOpen = useAiChatKeyboard(
    viewport,
    isOpen && isMobile && editing,
  );
  useLayoutEffect(() => {
    onKeyboardVisibilityChange?.(keyboardOpen);
    return () => onKeyboardVisibilityChange?.(false);
  }, [keyboardOpen, onKeyboardVisibilityChange]);
  if (!isOpen && mobileExpanded) setMobileExpanded(false);
  const compact = isMobile && !mobileExpanded;
  const expand = () => setMobileExpanded(true);
  const { draft, messages, errorMessage, isPending, setDraft, send, retry } =
    useAiChatConversation(onAuthenticationRequired, contextLabel);
  const query = useMyChecklistQueryRepository();
  const [addedTask, setAddedTask] = useState<{
    title: string;
    taskId?: string;
  } | null>(null);
  const additionRequestRef = useRef<AbortController | null>(null);
  useEffect(() => () => additionRequestRef.current?.abort(), []);
  const recommendations = useAiChatRecommendations(
    messages,
    isAuthenticated,
    onAuthenticationRequired,
    (catalogItemId) => {
      additionRequestRef.current?.abort();
      const controller = new AbortController();
      additionRequestRef.current = controller;
      setAddedTask({ title: "할 일을 체크리스트에 추가했어요." });
      void query
        .getChecklist(controller.signal)
        .then((checklist) => {
          if (controller.signal.aborted) return;
          const item = checklist.items.find(
            (item) => item.sourceCatalogItemId === catalogItemId,
          );
          if (item)
            setAddedTask({
              title: `${item.title} 추가 완료`,
              taskId: `checklist-item-${item.id}`,
            });
        })
        .catch(() => {});
    },
  );
  const active = isOpen && !compact;
  const view = isAuthenticated ? (
    <AiChatView
      active={active}
      isAuthenticated
      feedbackAudienceKey={feedbackAudienceKey}
      feedbackAfterMessageId={getAiChatFeedbackAnchor(messages)}
      compact={compact}
      viewport={viewport}
      onComposerFocus={() => {
        setEditing(true);
        expand();
      }}
      onComposerBlur={() => setEditing(false)}
      draft={draft}
      messages={messages}
      errorMessage={errorMessage}
      isPending={isPending}
      recommendations={recommendations}
      onDraftChange={setDraft}
      onSend={(text) => {
        expand();
        void send(text);
      }}
      onRetry={retry}
    />
  ) : (
    <GuestAiChatView
      active={active}
      recommendations={recommendations}
      compact={compact}
      viewport={viewport}
      onComposerFocus={expand}
    />
  );

  return (
    <GlobalAiChatDialog
      open={isOpen}
      viewport={viewport}
      keyboardOpen={keyboardOpen}
      mobileExpanded={mobileExpanded}
      onMobileCollapse={() => setMobileExpanded(false)}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
    >
      {view}
      {addedTask && (
        <div className="global-ai-result" hidden={compact}>
          <p role="status">{addedTask.title}</p>
          <AddedTaskLink taskId={addedTask.taskId} onClose={onClose} />
        </div>
      )}
    </GlobalAiChatDialog>
  );
}
