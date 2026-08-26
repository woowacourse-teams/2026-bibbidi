package com.bibbidi.wedding.user.persistence;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JpaUserRepository extends JpaRepository<JpaUserEntity, Long> {

    boolean existsByNicknameIgnoreCase(String nickname);

    boolean existsByNicknameIgnoreCaseAndIdNot(String nickname, Long id);

    Optional<JpaUserEntity> findByNicknameIgnoreCase(String nickname);
}
