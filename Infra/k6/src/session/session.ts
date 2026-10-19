import { sleep } from 'k6';
import type { ApiFactory } from '../api/api.ts';
import { REFRESH_BURST_RATIO, THINK } from '../config/targets.ts';
import { pickRandom, refreshTokenFor, UserIds, type PooledUser } from './users.ts';

export interface SetupData {
  runId: number;
  catalogItemIds: number[];
  pool: PooledUser[];
  refreshTokenCount: number;
}

export interface SessionContext {
  data: SetupData;
  iteration: number;
  apis: ApiFactory;
}

export interface Session {
  run(context: SessionContext): void;
}

// 화면 사이에 사용자가 머무는 시간. 1~3초를 쉰다.
export function think(): void {
  const range = THINK.maxSeconds - THINK.minSeconds;
  if (range < 0 || THINK.maxSeconds === 0) {
    return;
  }
  sleep(THINK.minSeconds + Math.random() * range);
}

// 신규: 준비 목록 둘러보기 → 체크리스트 만들고 담기 → 일정 잡기 → 홈
export class NewUserSession implements Session {
  run({ data, iteration, apis }: SessionContext): void {
    const api = apis.forUser(UserIds.fresh(data.runId, iteration));

    api.catalogItemIds();
    think();
    api.createChecklist();
    const [firstItemId] = api.addCatalogItems(pickRandom(data.catalogItemIds, 3));
    think();
    api.createAppointment(firstItemId, 1 + (iteration % 28));
    think();
    api.visitHome();
  }
}

// 재방문: 홈 → 체크리스트 확인 → 일정 완료 표시
export class ReturningUserSession implements Session {
  run({ data, iteration, apis }: SessionContext): void {
    const user = data.pool[iteration % data.pool.length];
    const api = apis.forUser(user.userId);

    api.visitHome();
    think();
    api.findChecklist();
    think();
    api.changeAppointmentCompletion(user.appointmentId, iteration % 2 === 0);
  }
}

// 카탈로그 조회 비중을 맞추려고 카탈로그만 보고 나가는 방문자
export class CatalogBrowseSession implements Session {
  run({ data, iteration, apis }: SessionContext): void {
    const user = data.pool[iteration % data.pool.length];
    apis.forUser(user.userId).catalogItems();
    think();
  }
}

// 앱을 다시 열어 세션을 갱신한 뒤 홈을 본다. 토큰은 시드가 만든 것을 반복 번호마다 하나씩, 한 번만 쓴다.
// 일부는 여러 탭이 같은 토큰으로 동시에 갱신하는 상황으로 findByTokenHashForUpdate의 행 잠금 경합을 만든다.
export class TokenRefreshSession implements Session {
  run({ data, iteration, apis }: SessionContext): void {
    if (iteration >= data.refreshTokenCount) {
      return;
    }

    const token = refreshTokenFor(iteration);
    const auth = apis.auth();
    const issued = Math.random() < REFRESH_BURST_RATIO ? auth.refreshFromTwoTabs(token) : auth.refresh(token);
    if (issued === null) {
      return;
    }

    think();
    apis.forAccessToken(issued.accessToken).visitHome();
  }
}

export interface SessionSelector {
  pick(iteration: number): Session;
}

export class SessionSequence implements SessionSelector {
  constructor(private readonly sessions: readonly Session[]) {}

  pick(iteration: number): Session {
    return this.sessions[iteration % this.sessions.length];
  }
}
