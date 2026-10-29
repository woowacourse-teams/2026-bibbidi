import { useEffect, useRef, useState } from "react";
import { ProgressBar } from "../../../components/progress-bar";
import type {
  BalanceGameOption,
  BalanceGameQuestion,
} from "../model/balanceGame";

function OptionImage({ path }: { path: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? null : (
    <img alt="" src={path} onError={() => setFailed(true)} draggable={false} />
  );
}

export function BalanceGameQuestionView({
  question,
  index,
  total,
  selected,
  submitting,
  error,
  onSelect,
}: {
  question: BalanceGameQuestion;
  index: number;
  total: number;
  selected?: BalanceGameOption["id"];
  submitting: boolean;
  error: string | null;
  onSelect: (id: BalanceGameOption["id"]) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [question.id]);
  const unknown = question.options.find((option) => option.id === "UNKNOWN");
  return (
    <div className="balance-game__question">
      <div className="balance-game__progress-label">
        <span>
          <strong>{String(index + 1).padStart(2, "0")}</strong> /{" "}
          {String(total).padStart(2, "0")}
        </span>
      </div>
      <ProgressBar
        aria-label="질문 진행"
        progress={(index + 1) / total}
        size="light"
        animate
      />
      <h1 id="balance-game-question" ref={heading} tabIndex={-1}>
        {question.question}
      </h1>
      <fieldset className="balance-game__choices" disabled={submitting}>
        <legend className="balance-game__sr-only">{question.question}</legend>
        <div className="balance-game__cards">
          {question.options
            .filter((option) => option.id !== "UNKNOWN")
            .map((option) => (
              <button
                type="button"
                className="balance-game__card"
                data-selected={selected === option.id || undefined}
                aria-pressed={selected === option.id}
                aria-label={option.text}
                onClick={() => onSelect(option.id)}
                key={option.id}
              >
                <span
                  className="balance-game__choice-marker"
                  aria-hidden="true"
                >
                  {option.id}
                </span>
                {option.imagePath && (
                  <span className="balance-game__image">
                    <OptionImage
                      key={option.imagePath}
                      path={option.imagePath}
                    />
                  </span>
                )}
                <span className="balance-game__choice-text">{option.text}</span>
              </button>
            ))}
        </div>
        {unknown && (
          <button
            type="button"
            className="balance-game__unknown"
            aria-pressed={selected === "UNKNOWN"}
            onClick={() => onSelect("UNKNOWN")}
          >
            {unknown.text}
          </button>
        )}
      </fieldset>
      {error && (
        <p className="balance-game__error" role="alert">
          {error}
        </p>
      )}
      {submitting && <p role="status">결과를 불러오고 있어요.</p>}
    </div>
  );
}
