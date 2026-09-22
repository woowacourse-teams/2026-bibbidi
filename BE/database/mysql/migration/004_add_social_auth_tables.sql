-- 소셜 OIDC 로그인과 JWT 인증 도입에 필요한 스키마 변경이다.
-- users에 가입 상태와 역할, 이메일을 더하고 비밀번호 인증을 걷어낸다.
-- 1회용 값(state, refresh token, handoff code)은 원문을 남기지 않고 해시만 저장한다.
-- 약관은 별도 테이블로 둔다. 문구와 버전이 바뀌어도 누가 무엇에 동의했는지 남는다.

ALTER TABLE users
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' AFTER nickname,
    ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'NORMAL' AFTER status,
    ADD COLUMN email VARCHAR(255) NULL AFTER role;

-- 기본값은 기존 회원을 채우기 위한 것이다. 채운 뒤에는 애플리케이션이 항상 값을 넣는다.
ALTER TABLE users
    ALTER COLUMN status DROP DEFAULT,
    ALTER COLUMN role DROP DEFAULT;

ALTER TABLE users
    DROP COLUMN password_hash;

CREATE TABLE social_identities (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    provider VARCHAR(20) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_social_identities_provider_user (provider, provider_user_id),
    UNIQUE KEY uk_social_identities_user (user_id)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE oidc_auth_requests (
    id BIGINT NOT NULL AUTO_INCREMENT,
    state_hash VARCHAR(64) NOT NULL,
    provider VARCHAR(20) NOT NULL,
    nonce VARCHAR(255) NOT NULL,
    code_verifier VARCHAR(255) NOT NULL,
    client_type VARCHAR(10) NOT NULL,
    purpose VARCHAR(20) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_oidc_auth_requests_state (state_hash),
    KEY idx_oidc_auth_requests_expires_at (expires_at)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE refresh_sessions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    family_id CHAR(36) NOT NULL,
    client_type VARCHAR(10) NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME NULL,
    rotated_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_refresh_sessions_token (token_hash),
    KEY idx_refresh_sessions_user (user_id),
    KEY idx_refresh_sessions_family (family_id),
    KEY idx_refresh_sessions_expires_at (expires_at)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE handoff_codes (
    id BIGINT NOT NULL AUTO_INCREMENT,
    code_hash VARCHAR(64) NOT NULL,
    user_id BIGINT NOT NULL,
    family_id CHAR(36) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_handoff_codes_code (code_hash),
    KEY idx_handoff_codes_expires_at (expires_at)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE terms (
    id BIGINT NOT NULL AUTO_INCREMENT,
    code VARCHAR(50) NOT NULL,
    version VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    required BOOLEAN NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_terms_code_version (code, version)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE terms_agreements (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    terms_id BIGINT NOT NULL,
    agreed_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_terms_agreements_user_terms (user_id, terms_id),
    KEY idx_terms_agreements_user (user_id)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;
