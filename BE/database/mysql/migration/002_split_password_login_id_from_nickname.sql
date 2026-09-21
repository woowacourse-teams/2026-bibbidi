-- users.nickname의 UNIQUE 제약을 password_login_id로 옮긴다.
-- 기존 UNIQUE 인덱스는 CREATE TABLE에서 이름 없이 선언해 인덱스 이름이 컬럼명과 같은 nickname이다.

ALTER TABLE users
    ADD COLUMN password_login_id VARCHAR(255) NULL AFTER nickname;

UPDATE users
SET password_login_id = nickname
WHERE password_login_id IS NULL;

ALTER TABLE users
    DROP INDEX nickname,
    ADD UNIQUE KEY uk_users_password_login_id (password_login_id),
    MODIFY COLUMN nickname VARCHAR(255) NOT NULL;
