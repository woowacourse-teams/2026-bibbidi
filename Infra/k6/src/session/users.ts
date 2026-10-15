import type { ApiFactory } from '../api/api.ts';

// 부하 테스트 전용 사용자 ID 대역. 이 값 이상의 owner_id는 정리 SQL이 테스트 데이터로 본다.
const LOAD_TEST_USER_ID_BASE = 900_000_000;
const NEW_USER_ID_OFFSET = 100_000_000_000;
const IDS_PER_RUN = 100_000;

export class UserIds {
  // 재방문 사용자 풀의 ID. 회차와 관계없이 같은 사용자를 가리킨다.
  static pooled(index: number): number {
    return LOAD_TEST_USER_ID_BASE + 1 + index;
  }

  // 신규 사용자 ID. 회차(runId)마다 대역이 달라 이전 회차 데이터와 부딪히지 않는다.
  static fresh(runId: number, iteration: number): number {
    return LOAD_TEST_USER_ID_BASE + NEW_USER_ID_OFFSET + runId * IDS_PER_RUN + iteration;
  }
}

export interface PooledUser {
  userId: number;
  appointmentId: number;
}

export function pickRandom(ids: readonly number[], count: number): number[] {
  const candidates = [...ids];
  const picked: number[] = [];
  while (picked.length < count && candidates.length > 0) {
    picked.push(candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0]);
  }
  return picked;
}

// 재방문 사용자는 이미 체크리스트와 일정이 있는 고정 풀로 준비한다.
export class ReturningUserPool {
  constructor(
    private readonly apis: ApiFactory,
    private readonly size: number,
  ) {}

  // 데이터가 이미 있으면 그대로 쓰고 없을 때만 만든다. 같은 서버에 다시 실행해도 데이터가 불어나지 않는다.
  prepare(catalogItemIds: number[]): PooledUser[] {
    return Array.from({ length: this.size }, (_, index) => this.prepareOne(UserIds.pooled(index), catalogItemIds));
  }

  private prepareOne(userId: number, catalogItemIds: number[]): PooledUser {
    const api = this.apis.forUser(userId);
    let checklist = api.findChecklist();

    if (checklist === null) {
      api.createChecklist();
      api.addCatalogItems(pickRandom(catalogItemIds, 3));
      checklist = api.findChecklist();
    }
    if (checklist === null || checklist.items.length === 0) {
      throw new Error(`재방문 사용자 ${userId}의 체크리스트를 준비하지 못했습니다.`);
    }

    const item = checklist.items[0];
    const appointmentId = item.appointments[0]?.id ?? api.createAppointment(item.id, 1);
    return { userId, appointmentId };
  }
}
