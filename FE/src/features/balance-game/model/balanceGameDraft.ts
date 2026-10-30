import { isContentId, parseResult } from "../api/balanceGame";
import type { GameTrackingSnapshot } from "../analytics/balanceGameTracking";
import type { BalanceGameAnswer, BalanceGameResult } from "./balanceGame";

const KEY = "bibbidi:balance-game:login-draft:v1";
const MAX_AGE = 30 * 60 * 1000;
export interface BalanceGameDraft {
  result: BalanceGameResult;
  answers: BalanceGameAnswer[];
  selectedIds: number[];
  tracking: GameTrackingSnapshot;
}
export function readBalanceGameDraft(): BalanceGameDraft | undefined {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(KEY) ?? "null");
    if (
      !value ||
      typeof value.savedAt !== "number" ||
      Date.now() - value.savedAt > MAX_AGE ||
      value.savedAt > Date.now() ||
      !Array.isArray(value.answers) ||
      value.answers.length > 200 ||
      !value.answers.every(
        (a: BalanceGameAnswer) =>
          a && isContentId(a.questionId) && isContentId(a.optionId),
      ) ||
      !Array.isArray(value.selectedIds) ||
      !value.selectedIds.every(
        (id: number) => Number.isSafeInteger(id) && id > 0,
      ) ||
      typeof value.tracking?.runId !== "string" ||
      value.tracking.runId.length > 100 ||
      !Number.isSafeInteger(value.tracking.answerRevision) ||
      value.tracking.answerRevision < 0 ||
      typeof value.tracking.started !== "boolean" ||
      (value.tracking.resultId !== undefined &&
        !isContentId(value.tracking.resultId)) ||
      (value.tracking.cardKey !== undefined &&
        (typeof value.tracking.cardKey !== "string" ||
          value.tracking.cardKey.length > 250))
    )
      return;
    const result = parseResult(value.result);
    if (
      !value.selectedIds.every((id: number) =>
        result.catalogItemIds.includes(id),
      )
    )
      return;
    return {
      result,
      answers: value.answers,
      selectedIds: value.selectedIds,
      tracking: value.tracking,
    };
  } catch {
    return;
  }
}
export function writeBalanceGameDraft(value: BalanceGameDraft): boolean {
  try {
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({ ...value, savedAt: Date.now() }),
    );
    return true;
  } catch {
    return false;
  }
}
export function clearBalanceGameDraft() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* 저장소가 막혀도 게임은 계속 진행한다. */
  }
}
