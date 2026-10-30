import { useEffect, useId, useRef, useState } from "react";
import { Button } from "../../components/button";
import { Checkbox } from "../../components/checkbox";
import { Result } from "../../components/result";
import {
  useBalanceGameRecommendations,
  type BalanceGameRecommendationsOptions,
} from "./useBalanceGameRecommendations";
import { BalanceGameResultCard } from "./view/BalanceGameResultCard";
import { BalanceGameRecommendationGroup } from "./view/BalanceGameRecommendationGroup";

export function BalanceGameResults(props: BalanceGameRecommendationsOptions) {
  const { result, resultInstanceId, audience } = props;
  const {
    groups,
    totalCount,
    availableCount,
    addedIds,
    selectedIds,
    status,
    saving,
    error,
    select,
    save,
    retry,
  } = useBalanceGameRecommendations(props);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const selectAllId = useId();

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <section
      className="balance-game__results"
      aria-labelledby="balance-game-result-title"
    >
      <h1
        id="balance-game-result-title"
        className="balance-game__sr-only"
        ref={heading}
        tabIndex={-1}
      >
        {result.name}
      </h1>
      <BalanceGameResultCard key={resultInstanceId} result={result} />
      <h2>우리에게 맞는 추천 할 일</h2>
      <p className="balance-game__description">
        목록을 확인하고 필요한 항목을 체크리스트에 담아보세요.
      </p>
      {status === "loading" && (
        <p role="status">이미 담은 할 일을 확인하고 있어요.</p>
      )}
      {status === "error" && (
        <Result
          title="추천 할 일을 불러오지 못했어요"
          button={<Result.Button onClick={retry}>다시 시도</Result.Button>}
        />
      )}
      {status === "ready" &&
        (totalCount ? (
          <>
            <div className="balance-game__selection-toolbar">
              <label htmlFor={selectAllId}>
                <Checkbox
                  id={selectAllId}
                  checked={
                    availableCount > 0 && selectedIds.length === availableCount
                  }
                  disabled={saving || !availableCount}
                  onCheckedChange={(checked) => select(checked)}
                />
                전체 선택
              </label>
              <span>
                {selectedIds.length}개 선택 · {totalCount - availableCount}개
                이미 담음
              </span>
            </div>
            <div className="balance-game__groups">
              {groups.map(({ category, items }) => (
                <BalanceGameRecommendationGroup
                  key={category}
                  category={category}
                  items={items}
                  addedIds={addedIds}
                  selectedIds={selectedIds}
                  saving={saving}
                  expanded={expandedCategories.includes(category)}
                  onSelect={select}
                  onToggle={() =>
                    setExpandedCategories((current) =>
                      current.includes(category)
                        ? current.filter((item) => item !== category)
                        : [...current, category],
                    )
                  }
                />
              ))}
            </div>
            {error && (
              <p className="balance-game__error" role="alert">
                {error}
              </p>
            )}
            <div className="balance-game__result-footer">
              <Button
                loading={saving}
                disabled={!selectedIds.length}
                onClick={() => void save()}
              >
                {selectedIds.length
                  ? audience === "guest"
                    ? `로그인하고 ${selectedIds.length}개 할 일 담기`
                    : `${selectedIds.length}개 할 일 담기`
                  : availableCount
                    ? "담을 할 일을 선택해 주세요"
                    : "모든 할 일을 담았어요"}
              </Button>
            </div>
          </>
        ) : (
          <Result title="추천된 할 일이 없어요" />
        ))}
    </section>
  );
}
