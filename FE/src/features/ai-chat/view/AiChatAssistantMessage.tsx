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
