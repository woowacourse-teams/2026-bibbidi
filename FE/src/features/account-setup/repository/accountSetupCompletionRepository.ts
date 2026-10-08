import {
  MyChecklistAuthenticationRequiredError,
  MyChecklistModel,
  MyChecklistQueryRepository,
  MyChecklistRequestAbortedError,
} from "../../checklist";

export type AccountSetupCompletion =
  { status: "complete"; checklist: MyChecklistModel } | { status: "required" };

export interface AccountSetupCompletionRepository {
  getCompletion(signal?: AbortSignal): Promise<AccountSetupCompletion>;
}

export class AccountSetupCompletionAuthenticationRequiredError extends Error {
  constructor(options?: ErrorOptions) {
    super("계정 설정 완료 여부를 확인하려면 로그인이 필요합니다.", options);
    this.name = "AccountSetupCompletionAuthenticationRequiredError";
  }
}

export class AccountSetupCompletionRequestAbortedError extends Error {
  constructor(options?: ErrorOptions) {
    super("계정 설정 완료 여부 확인이 취소됐습니다.", options);
    this.name = "AccountSetupCompletionRequestAbortedError";
  }
}

export class AccountSetupCompletionCheckError extends Error {
  constructor(options?: ErrorOptions) {
    super("계정 설정 완료 여부를 확인하지 못했습니다.", options);
    this.name = "AccountSetupCompletionCheckError";
  }
}

export function createAccountSetupCompletionRepository(
  checklistQueryRepository: MyChecklistQueryRepository,
): AccountSetupCompletionRepository {
  return {
    async getCompletion(signal) {
      try {
        const checklist = await checklistQueryRepository.getChecklist(signal);

        return checklist.exists
          ? { status: "complete", checklist }
          : { status: "required" };
      } catch (error) {
        if (error instanceof MyChecklistAuthenticationRequiredError) {
          throw new AccountSetupCompletionAuthenticationRequiredError({
            cause: error,
          });
        }

        if (error instanceof MyChecklistRequestAbortedError) {
          throw new AccountSetupCompletionRequestAbortedError({ cause: error });
        }

        throw new AccountSetupCompletionCheckError({ cause: error });
      }
    },
  };
}
