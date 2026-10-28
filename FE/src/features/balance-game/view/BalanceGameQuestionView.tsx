import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/button";
import { Checkbox } from "../../../components/checkbox";
import { ProgressBar } from "../../../components/progress-bar";
import { ChevronRight } from "../../../components/icons/Chevron";
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
  onNext,
}: {
  question: BalanceGameQuestion;
  index: number;
  total: number;
  selected?: BalanceGameOption["id"];
  submitting: boolean;
  error: string | null;
  onSelect: (id: BalanceGameOption["id"]) => void;
  onNext: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [question.id]);
  const unknown = question.options.find((option) => option.id === "UNKNOWN");
  return (
    <div className="balance-game__question">
      <div className="balance-game__progress-label">
        <span>가볍게 골라보는 우리의 결혼 준비</span>
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
      <p className="balance-game__eyebrow">우리 결혼 밸런스게임</p>
      <h1 id="balance-game-question" ref={heading} tabIndex={-1}>
        {question.question}
      </h1>
      <fieldset className="balance-game__choices" disabled={submitting}>
        <legend className="balance-game__sr-only">{question.question}</legend>
        <div className="balance-game__cards">
          {question.options
            .filter((option) => option.id !== "UNKNOWN")
            .map((option) => (
              <label
                className="balance-game__card"
                data-selected={selected === option.id || undefined}
                key={option.id}
              >
                <span
                  className="balance-game__choice-marker"
                  aria-hidden="true"
                >
                  {option.id}
                </span>
                <Checkbox
                  inputType="radio"
                  name={`question-${question.id}`}
                  checked={selected === option.id}
                  onCheckedChange={() => onSelect(option.id)}
                  aria-label={option.text}
                />
                {option.imagePath && (
                  <div className="balance-game__image">
                    <OptionImage
                      key={option.imagePath}
                      path={option.imagePath}
                    />
                  </div>
                )}
                <span className="balance-game__choice-text">{option.text}</span>
              </label>
            ))}
        </div>
        {unknown && (
          <label
            className="balance-game__unknown"
            data-selected={selected === "UNKNOWN" || undefined}
          >
            <Checkbox
              inputType="radio"
              name={`question-${question.id}`}
              checked={selected === "UNKNOWN"}
              onCheckedChange={() => onSelect("UNKNOWN")}
            />
            {unknown.text}
          </label>
        )}
      </fieldset>
      <p className="balance-game__hint">
        지금 마음에 가까운 쪽을 골라요. 정답은 없어요.
      </p>
      {error && (
        <p className="balance-game__error" role="alert">
          {error}
        </p>
      )}
      <div className="balance-game__footer">
        <span className="balance-game__hint">
          이전 질문으로 돌아가 답을 바꿀 수 있어요.
        </span>
        <Button disabled={!selected} loading={submitting} onClick={onNext}>
          {index === total - 1 ? "추천 할 일 보기" : "다음 질문"}
          <ChevronRight size={18} />
        </Button>
      </div>
    </div>
  );
}
