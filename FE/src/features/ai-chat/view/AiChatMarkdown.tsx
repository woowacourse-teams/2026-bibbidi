import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import "./AiChatMarkdown.css";

const components: Components = {
  a({ children, href, title }) {
    return (
      <a href={href} rel="noopener noreferrer" target="_blank" title={title}>
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div
        aria-label="AI 답변 표"
        className="ai-chat__table-scroll"
        role="region"
        // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- 키보드로 넓은 표를 가로 스크롤할 수 있도록 포커스를 허용한다.
        tabIndex={0}
      >
        <table>{children}</table>
      </div>
    );
  },
  pre({ children }) {
    return (
      // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- 키보드로 긴 코드를 가로 스크롤할 수 있도록 포커스를 허용한다.
      <pre tabIndex={0}>{children}</pre>
    );
  },
};

export function AiChatMarkdown({ text }: { text: string }) {
  return (
    <div className="ai-chat__markdown">
      <Markdown components={components} remarkPlugins={[remarkGfm]}>
        {text}
      </Markdown>
    </div>
  );
}
