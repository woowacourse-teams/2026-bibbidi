import { RefObject, useRef, useState, useEffect } from "react";

import { useAiChatConversation } from "./hooks/useAiChatConversation";
import { useAiChatRecommendations } from "./hooks/useAiChatRecommendations";
import { GlobalAiChatDialog } from "./view/GlobalAiChatDialog";
import { Button } from "../../components/button";
import { useLinkClickHandler } from "react-router";
import { useMyChecklistQueryRepository } from "../checklist";
import { AiChatView } from "./view/AiChatView";
import { createGuestChatMessages, type ChatMessage } from "./model/aiChat";
import type { RecommendationController } from "./model/recommendation";

function GuestAiChatView({
  active,
  recommendations,
}: {
  active: boolean;
  recommendations: RecommendationController;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  return (
    <AiChatView
      active={active}
      isAuthenticated={false}
      draft=""
      messages={messages}
      errorMessage={null}
      isPending={false}
      recommendations={recommendations}
      onDraftChange={() => {}}
      onRetry={() => {}}
      onSend={(question) => {
        const nextMessages = createGuestChatMessages(question);
        if (nextMessages) setMessages(nextMessages);
      }}
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
  isOpen,
  onAuthenticationRequired,
  onClose,
  returnFocusRef,
  contextLabel,
}: {
  isAuthenticated: boolean;
  isOpen: boolean;
  onAuthenticationRequired: () => void;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  contextLabel?: string;
}) {
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
  const active = isOpen;
  const view = isAuthenticated ? (
    <AiChatView
      active={active}
      isAuthenticated
      draft={draft}
      messages={messages}
      errorMessage={errorMessage}
      isPending={isPending}
      recommendations={recommendations}
      onDraftChange={setDraft}
      onSend={send}
      onRetry={retry}
    />
  ) : (
    <GuestAiChatView active={active} recommendations={recommendations} />
  );

  return (
    <GlobalAiChatDialog
      open={isOpen}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      contextLabel={contextLabel}
    >
      {view}
      {addedTask && (
        <div className="global-ai-result">
          <p role="status">{addedTask.title}</p>
          <AddedTaskLink taskId={addedTask.taskId} onClose={onClose} />
        </div>
      )}
    </GlobalAiChatDialog>
  );
}
