import type { Scenario } from 'k6/options';
import { ApiFactory } from '../api/api.ts';
import type { AiChatClient } from '../api/ai-chat-client.ts';
import { Environment } from '../common/environment.ts';
import { AccessTokenIssuer } from '../common/token.ts';
import type { TagProvider } from '../config/shape.ts';
import { MIX } from '../config/targets.ts';
import { HttpClient } from '../http/http.ts';
import {
  CatalogBrowseSession,
  NewUserSession,
  ReturningUserSession,
  TokenRefreshSession,
  type SetupData,
} from '../session/session.ts';
import { LoadTest } from './load-test.ts';

export interface ScenarioShape {
  scenario(flow: string, share: number): Scenario;
}

// 일반 API 부하의 흐름 4종. 시나리오마다 도착률을 나눠 신규·재방문·카탈로그·토큰 갱신 비율을 맞춘다.
export class GeneralLoad {
  private readonly test: LoadTest;
  private readonly newUserSession = new NewUserSession();
  private readonly returningUserSession = new ReturningUserSession();
  private readonly catalogBrowseSession = new CatalogBrowseSession();
  private readonly tokenRefreshSession = new TokenRefreshSession();

  constructor(
    environment: Environment,
    requestTags: TagProvider,
    chatClient?: AiChatClient,
  ) {
    const apis = new ApiFactory(
      new HttpClient(environment.baseUrl, requestTags),
      new AccessTokenIssuer(environment),
      chatClient,
    );
    this.test = new LoadTest(apis);
    this.apis = apis;
  }

  readonly apis: ApiFactory;

  setup(): SetupData {
    return this.test.setup();
  }

  newUser(data: SetupData): void {
    this.test.run(this.newUserSession, data);
  }

  returningUser(data: SetupData): void {
    this.test.run(this.returningUserSession, data);
  }

  catalogBrowse(data: SetupData): void {
    this.test.run(this.catalogBrowseSession, data);
  }

  tokenRefresh(data: SetupData): void {
    this.test.run(this.tokenRefreshSession, data);
  }

  runner(): LoadTest {
    return this.test;
  }
}

export function generalScenarios(shape: ScenarioShape): Record<string, Scenario> {
  return {
    new_users: shape.scenario('newUser', MIX.newUser),
    returning_users: shape.scenario('returningUser', MIX.returningUser),
    catalog_browse: shape.scenario('catalogBrowse', MIX.catalogBrowse),
    token_refresh: shape.scenario('tokenRefresh', MIX.tokenRefresh),
  };
}
