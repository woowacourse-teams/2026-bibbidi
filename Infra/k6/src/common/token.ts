import { hmac } from 'k6/crypto';
import { b64encode } from 'k6/encoding';
import type { Environment } from './environment.ts';

// 서버(BibbidiTokenIssuer)가 만드는 Access Token과 같은 클레임을 같은 시크릿(UTF-8 바이트)으로 서명한다.
export class AccessTokenIssuer {
  constructor(private readonly environment: Environment) {}

  issue(userId: number): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      jti: `${userId}-${issuedAt}-${Math.random().toString(36).slice(2)}`,
      iss: this.environment.jwtIssuer,
      aud: [this.environment.jwtAudience],
      sub: String(userId),
      iat: issuedAt,
      exp: issuedAt + this.environment.tokenLifetimeSeconds,
      category: 'ACCESS',
      status: 'ACTIVE',
      role: 'NORMAL',
      nickname: `k6-${userId}`,
      email: `k6-${userId}@loadtest.invalid`,
    };

    const signingInput = `${this.encode(JSON.stringify(header))}.${this.encode(JSON.stringify(payload))}`;
    const signature = hmac('sha256', this.environment.jwtSecret, signingInput, 'binary');
    return `${signingInput}.${this.encode(signature)}`;
  }

  private encode(input: string | ArrayBuffer): string {
    return b64encode(input, 'rawurl');
  }
}
