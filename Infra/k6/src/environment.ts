function required(name: string): string {
  const value = __ENV[name];
  if (!value) {
    throw new Error(`환경 변수 ${name}가 필요합니다.`);
  }
  return value;
}

export function numberFromEnv(name: string, fallback: number): number {
  const value = __ENV[name];
  return value ? Number(value) : fallback;
}

export function textFromEnv(name: string, fallback: string): string {
  return __ENV[name] ?? fallback;
}

// 서버 주소와 토큰 서명에 필요한 값. 테스트 종류와 관계없이 모든 스크립트가 같이 쓴다.
export class Environment {
  private constructor(
    readonly baseUrl: string,
    readonly jwtSecret: string,
    readonly jwtIssuer: string,
    readonly jwtAudience: string,
    readonly tokenLifetimeSeconds: number,
  ) {}

  static fromEnv(): Environment {
    return new Environment(
      required('BASE_URL').replace(/\/+$/, ''),
      required('AUTH_JWT_SECRET'),
      textFromEnv('AUTH_JWT_ISSUER', 'bibbidi'),
      textFromEnv('AUTH_JWT_AUDIENCE', 'bibbidi-client'),
      numberFromEnv('TOKEN_LIFETIME_SECONDS', 1800),
    );
  }
}
