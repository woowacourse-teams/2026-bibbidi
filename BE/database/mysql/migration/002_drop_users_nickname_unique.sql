-- 카카오에서 받은 닉네임은 서로 겹칠 수 있어 유일 제약을 유지할 수 없다.
-- 기존 UNIQUE 인덱스는 CREATE TABLE에서 이름 없이 선언해 인덱스 이름이 컬럼명과 같은 nickname이다.

ALTER TABLE users
    DROP INDEX nickname,
    MODIFY COLUMN nickname VARCHAR(255) NOT NULL;
