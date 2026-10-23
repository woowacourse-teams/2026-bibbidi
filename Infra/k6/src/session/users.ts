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

// 시드(generate-seed.py)가 만든 사용자 한 명의 데이터. 사용자 i(0부터)는 체크리스트 1개, 항목 3개, 일정 1개를 가진다.
// 항목은 모두 준비 목록에서 추가한 것이라 제목·카테고리를 바꿀 수 없다.
export class Seeded {
  static userId(index: number): number {
    return UserIds.pooled(index);
  }

  static checklistItemId(index: number): number {
    return LOAD_TEST_USER_ID_BASE + index * 3 + 1;
  }

  static appointmentId(index: number): number {
    return LOAD_TEST_USER_ID_BASE + index + 1;
  }

  // 시드가 사용자 i에게 담아 둔 준비 목록 항목 번호(1부터)는 (i*3+j) % 169 + 1 이다. 그 뒤 번호부터 골라 중복을 피한다.
  static unusedCatalogRank(index: number, offset: number, catalogSize: number): number {
    return (index * 3 + 3 + offset) % catalogSize;
  }
}

// AI 대화 사용자는 신규 사용자와 ID가 겹치지 않게 반복 번호에 이 값을 더한다. 신규 사용자는 이 값 미만의 반복 번호만 쓴다.
export const AI_USER_ITERATION_OFFSET = 50_000;

// 시드(generate-seed.py)가 만든 리프레시 세션의 토큰. 번호마다 하나이고 한 번만 쓸 수 있다.
export function refreshTokenFor(index: number): string {
  return `loadtest-refresh-${index}`;
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
