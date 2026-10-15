import type { ApiFactory } from './api.ts';
import { pickRandom, UserIds, type PooledUser } from './users.ts';

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

export interface Session {
  run(context: SessionContext): void;
}

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

export class ReturningUserSession implements Session {
  run({ data, iteration, apis }: SessionContext): void {
    const user = data.pool[iteration % data.pool.length];
    const api = apis.forUser(user.userId);

    api.visitHome();
    api.findChecklist();
    api.changeAppointmentCompletion(user.appointmentId, iteration % 2 === 0);
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

export interface WeightedSession {
  session: Session;
  weight: number;
}

export class SessionMix implements SessionSelector {
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
