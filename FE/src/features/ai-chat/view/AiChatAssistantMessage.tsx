import type { ComponentPropsWithRef } from "react";

export function AiChatAssistantMessage({
  children,
  className,
  ...props
}: ComponentPropsWithRef<"div">) {
  return (
    <div
      {...props}
      className={`ai-chat__message ai-chat__message--assistant${className ? ` ${className}` : ""}`}
    >
      <strong className="ai-chat__author">Bibbidi</strong>
      {children}
    </div>
  );
}

export function AiChatRecommendationComplete({
  ref,
}: Pick<ComponentPropsWithRef<"div">, "ref">) {
  return (
    <AiChatAssistantMessage
      className="ai-chat__recommendation-complete"
      ref={ref}
      role="status"
      tabIndex={-1}
    >
      <p>추천을 모두 확인했어요. 더 궁금한 준비가 있나요?</p>
    </AiChatAssistantMessage>
  );
}
