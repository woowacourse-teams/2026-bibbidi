import {
  MyChecklistAuthenticationRequiredError,
  MyChecklistQueryRepository,
  MyChecklistRequestAbortedError,
} from "../../checklist";
import {
  AppHeaderSummaryModel,
  createAppHeaderSummaryModel,
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
  checklistRepository: MyChecklistQueryRepository,
): AppHeaderSummaryRepository {
  return {
    async getSummary(signal) {
      try {
        const checklist = await checklistRepository.getChecklist(signal);

        return createAppHeaderSummaryModel(checklist.items);
      } catch (error) {
        if (error instanceof MyChecklistAuthenticationRequiredError) {
          throw new AppHeaderAuthenticationRequiredError({ cause: error });
        }

        if (error instanceof MyChecklistRequestAbortedError) {
          throw new AppHeaderSummaryRequestAbortedError({ cause: error });
        }

        throw new AppHeaderSummaryLoadError({ cause: error });
      }
    },
  };
}
