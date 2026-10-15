import type { ApiFactory } from './api.ts';
import { pickRandom, UserIds, type PooledUser } from './users.ts';

// setup()이 만들어 모든 가상 사용자에게 나눠 주는 데이터. JSON으로 전달되므로 일반 객체만 담는다.
export interface SetupData {
  runId: number;
  catalogItemIds: number[];
  pool: PooledUser[];
}

export interface SessionContext {
  data: SetupData;
  iteration: number;
  apis: ApiFactory;
}

// 사용 흐름도의 한 갈래를 사용자 한 명이 끝까지 지나가는 단위
export interface Session {
  run(context: SessionContext): void;
}

// 신규 사용자: 둘러보기 → 체크리스트 담기 → 일정 잡기 → 홈
export class NewUserSession implements Session {
  run({ data, iteration, apis }: SessionContext): void {
    const api = apis.forUser(UserIds.fresh(data.runId, iteration));

    api.catalogItemIds();
    api.createChecklist();
    const [firstItemId] = api.addCatalogItems(pickRandom(data.catalogItemIds, 3));
    api.createAppointment(firstItemId, 1 + (iteration % 28));
    api.visitHome();
  }
}

// 재방문 사용자: 홈 → 진행하기
export class ReturningUserSession implements Session {
  run({ data, iteration, apis }: SessionContext): void {
    const user = data.pool[iteration % data.pool.length];
    const api = apis.forUser(user.userId);

    api.visitHome();
    api.findChecklist();
    api.changeAppointmentCompletion(user.appointmentId, iteration % 2 === 0);
  }
}

export interface WeightedSession {
  session: Session;
  weight: number;
}

// 세션 종류를 가중치 비율로 섞는다. 예: 신규:재방문 3:7
export class SessionMix {
  private readonly totalWeight: number;

  constructor(private readonly entries: readonly WeightedSession[]) {
    this.totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  }

  pick(): Session {
    let point = Math.random() * this.totalWeight;
    for (const entry of this.entries) {
      point -= entry.weight;
      if (point < 0) {
        return entry.session;
      }
    }
    return this.entries[this.entries.length - 1].session;
  }
}
