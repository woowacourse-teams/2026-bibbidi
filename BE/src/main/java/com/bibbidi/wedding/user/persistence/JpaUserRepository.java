package com.bibbidi.wedding.user.persistence;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JpaUserRepository extends JpaRepository<JpaUserEntity, Long> {

    boolean existsByNicknameIgnoreCase(String nickname);

    Optional<JpaUserEntity> findByNicknameIgnoreCase(String nickname);
}
