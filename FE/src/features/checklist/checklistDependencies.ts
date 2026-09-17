import { remoteMyChecklistCommandDataSource } from "./data-source/remoteMyChecklistCommandDataSource";
import { remoteMyChecklistDataSource } from "./data-source/remoteMyChecklistDataSource";
import { createMyChecklistCommandRepository } from "./repository/myChecklistCommandRepository";
import { createMyChecklistQueryRepository } from "./repository/myChecklistQueryRepository";

export function createMyChecklistRepositoriesDependency() {
  const queryRepository = createMyChecklistQueryRepository(
    remoteMyChecklistDataSource,
  );

  return {
    commandRepository: createMyChecklistCommandRepository(
      remoteMyChecklistCommandDataSource,
      queryRepository,
    ),
    queryRepository,
  };
}
