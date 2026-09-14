export class PreparationAuthenticationRequiredError extends Error {
  constructor() {
    super("로그인이 필요합니다.");
    this.name = "PreparationAuthenticationRequiredError";
  }
}

export class PreparationChecklistAdditionError extends Error {
  constructor(
    message = "할 일을 추가하지 못했어요. 다시 시도해 주세요.",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PreparationChecklistAdditionError";
  }
}

export class PreparationChecklistNotFoundError extends PreparationChecklistAdditionError {
  constructor(
    message = "체크리스트를 찾을 수 없습니다.",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PreparationChecklistNotFoundError";
  }
}

export class PreparationDuplicateChecklistItemError extends PreparationChecklistAdditionError {
  constructor(
    message = "이미 추가된 준비 항목입니다.",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PreparationDuplicateChecklistItemError";
  }
}
