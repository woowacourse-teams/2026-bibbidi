import { Loader } from "../../../components/loader";
import { Result } from "../../../components/result";
import "./ChecklistState.css";

interface ChecklistStateProps {
  errorMessage?: string;
  onRetry?: () => void;
  status: "authentication-required" | "empty" | "error" | "loading";
}

export function ChecklistState({
  errorMessage,
  onRetry,
  status,
}: ChecklistStateProps) {
  if (status === "loading") {
    return (
      <div className="checklist-state">
        <Loader label="체크리스트를 불러오고 있어요." />
      </div>
    );
  }

  if (status === "empty") {
    return <Result role="status" title="표시할 체크리스트가 없어요." />;
  }

  if (status === "authentication-required") {
    return (
      <Result
        role="alert"
        title="로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요."
        button={<Result.Button onClick={onRetry}>다시 시도</Result.Button>}
      />
    );
  }

  return (
    <Result
      role="alert"
      title={errorMessage ?? "체크리스트를 불러오지 못했어요."}
      button={<Result.Button onClick={onRetry}>다시 시도</Result.Button>}
    />
  );
}
