-- WARNING: This script drops and recreates the bibbidi database.
-- All existing data will be permanently deleted when this script runs.

DROP DATABASE IF EXISTS bibbidi;
CREATE DATABASE bibbidi;
USE bibbidi;

SET time_zone = '+09:00';

CREATE TABLE users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    nickname VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL,
    role VARCHAR(20) NOT NULL,
    email VARCHAR(255) NULL,
    terms_version VARCHAR(20) NULL,
    terms_agreed_at DATETIME NULL,
    password_hash VARCHAR(255) NULL,
    wedding_date DATE NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE categories (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    display_order INT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (display_order)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE steps (
    id BIGINT NOT NULL AUTO_INCREMENT,
    category_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(500),
    icon_url VARCHAR(255),
    display_order INT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (category_id, display_order),
    CONSTRAINT fk_steps_category
        FOREIGN KEY (category_id) REFERENCES categories (id)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE catalog_items (
    id BIGINT NOT NULL AUTO_INCREMENT,
    step_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    display_order INT NOT NULL,
    essential BOOLEAN NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (step_id, display_order),
    CONSTRAINT fk_catalog_items_step
        FOREIGN KEY (step_id) REFERENCES steps (id)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE precedences (
    id BIGINT NOT NULL AUTO_INCREMENT,
    item_id BIGINT NOT NULL,
    preceding_item_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (item_id, preceding_item_id),
    CONSTRAINT ck_precedences_not_self CHECK (item_id <> preceding_item_id)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE checklists (
    id BIGINT NOT NULL AUTO_INCREMENT,
    owner_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (owner_id)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE checklist_items (
    id BIGINT NOT NULL AUTO_INCREMENT,
    checklist_id BIGINT NOT NULL,
    category_id BIGINT,
    source_catalog_item_id BIGINT,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (checklist_id, source_catalog_item_id),
    INDEX idx_checklist_items_source_catalog_item_id (source_catalog_item_id)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE appointments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    checklist_item_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    appointment_date DATE NOT NULL,
    start_time DATETIME,
    end_time DATETIME,
    place VARCHAR(255),
    memo TEXT,
    is_done BOOLEAN NOT NULL,
    done_by_checklist_item BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_appointments_checklist_item_id (checklist_item_id)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE feedbacks (
    id BIGINT NOT NULL AUTO_INCREMENT,
    sentiment VARCHAR(20) NOT NULL,
    content VARCHAR(255),
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

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
    browser_binder_hash VARCHAR(64) NULL,
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
