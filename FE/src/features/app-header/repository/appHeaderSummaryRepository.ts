import type { CatalogCategoryModel } from "../../catalog";
import {
  ChecklistQueryAuthenticationRequiredError,
  ChecklistQueryRepository,
  ChecklistQueryRequestAbortedError,
  MyChecklistAuthenticationRequiredError,
  MyChecklistRequestAbortedError,
  type MyChecklistQueryRepository,
} from "../../checklist";
import {
  AppHeaderSummaryModel,
  createAppHeaderSummaryModel,
  summarizePersonalChecklist,
} from "../model/appHeaderSummary";

export interface AppHeaderSummaryRepository {
  getSummary(signal?: AbortSignal): Promise<AppHeaderSummaryModel>;
}

export class AppHeaderAuthenticationRequiredError extends Error {
  constructor(options?: ErrorOptions) {
    super("로그인이 필요합니다.", options);
    this.name = "AppHeaderAuthenticationRequiredError";
  }
}

export class AppHeaderSummaryLoadError extends Error {
  constructor(options?: ErrorOptions) {
    super("헤더의 체크리스트 완료율을 불러오지 못했습니다.", options);
    this.name = "AppHeaderSummaryLoadError";
  }
}

export class AppHeaderSummaryRequestAbortedError extends Error {
  constructor(options?: ErrorOptions) {
    super("헤더의 체크리스트 완료율 요청이 취소됐습니다.", options);
    this.name = "AppHeaderSummaryRequestAbortedError";
  }
}

export function createAppHeaderSummaryRepository(
  checklistRepository: ChecklistQueryRepository,
): AppHeaderSummaryRepository {
  return createSummaryRepository(async (signal) =>
    createAppHeaderSummaryModel(
      await checklistRepository.getChecklist("authenticated", signal),
    ),
  );
}

export function createSnapshotHeaderSummaryRepository(
  catalogCategories: CatalogCategoryModel[],
  checklistRepository: MyChecklistQueryRepository,
): AppHeaderSummaryRepository {
  return createSummaryRepository(async (signal) => {
    const { items } = await checklistRepository.getChecklist(signal);
    return summarizePersonalChecklist(catalogCategories, items);
  });
}

function createSummaryRepository(
  load: AppHeaderSummaryRepository["getSummary"],
): AppHeaderSummaryRepository {
  return {
    async getSummary(signal) {
      try {
        return await load(signal);
      } catch (error) {
        if (
          error instanceof ChecklistQueryAuthenticationRequiredError ||
          error instanceof MyChecklistAuthenticationRequiredError
        ) {
          throw new AppHeaderAuthenticationRequiredError({ cause: error });
        }

        if (
          error instanceof ChecklistQueryRequestAbortedError ||
          error instanceof MyChecklistRequestAbortedError
        ) {
          throw new AppHeaderSummaryRequestAbortedError({ cause: error });
        }

        throw new AppHeaderSummaryLoadError({ cause: error });
      }
    },
  };
}
