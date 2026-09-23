ALTER TABLE users
    ADD COLUMN terms_version VARCHAR(20) NULL AFTER email,
    ADD COLUMN terms_agreed_at DATETIME NULL AFTER terms_version;

ALTER TABLE oidc_auth_requests
    ADD COLUMN browser_binder_hash VARCHAR(64) NULL AFTER code_verifier;
