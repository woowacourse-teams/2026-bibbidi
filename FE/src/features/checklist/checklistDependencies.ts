import { remoteMyChecklistDataSource } from "./data-source/remoteMyChecklistDataSource";
import { createMyChecklistQueryRepository } from "./repository/myChecklistQueryRepository";

export function createMyChecklistQueryRepositoryDependency() {
  return createMyChecklistQueryRepository(remoteMyChecklistDataSource);
}
